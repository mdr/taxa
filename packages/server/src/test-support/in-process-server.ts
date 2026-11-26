/**
 * The real server inside a test's own process, on a spare port, a fake clock
 * and a fresh PGlite database: a test drives it through the same HTTP API
 * that the web app, the CLI and agents use.
 */
import type { AddressInfo } from "node:net"
import { serve, type ServerType } from "@hono/node-server"
import { HEALTH_PATH, HealthSchema, type Health } from "@taxa/shared/api/health"
import { FakeClock } from "@taxa/shared/test-support/fake-clock"
import type { Instant, Ms } from "@taxa/shared/units"
import { createKey } from "../agents/agent-store.ts"
import { createApp, type DevLogin } from "../app.ts"
import { eq } from "drizzle-orm"
import type { DomainId, TaskId } from "@taxa/shared/ids"
import { activity, comments, domainMembers, occurrences, tasks } from "../database/schema.ts"
import { clearOldBin } from "../tasks/task-purge.ts"
import type { Database } from "../database/database.ts"
import { createLogger, type LogRecord } from "@taxa/shared/telemetry/log"
import type { ServerLogCode, ServerLogger } from "../telemetry/log.ts"
import type { CallerUser } from "../auth/caller.ts"
import { createUser, ensureUserNamed } from "../users/user-store.ts"
import { pgliteDatabase } from "./pglite-database.ts"
import type { SignInOptions } from "../auth/sign-in-config.ts"
import type { TaxaApp } from "../http/taxa-hono.ts"
import { TestUser } from "./test-user.ts"
import { timeZone as zoneNamed, type TimeZone } from "@taxa/shared/dates/plain-date"

const LONDON = zoneNamed("Europe/London")

/** Monday 5 January 2026, 09:00 UTC: where every test's clock starts unless it says otherwise. */
const TEST_START: Instant = Date.UTC(2026, 0, 5, 9, 0)

export interface InProcessOptions {
  /** The clock stands here until advanced. */
  startAt?: Instant
  /** Pages on other origins allowed to call the API: the browser tests' dev server. */
  corsOrigins?: string[]
  /** Callers without an API key are this person, as in development. */
  devLogin?: DevLogin
  /** The built web app's folder, to serve beside the API. */
  webRoot?: string
  /** People sign in, given where the server's reached, which is known only once it's listening. */
  signIn?: (publicUrl: URL) => SignInOptions
}

const listen = (server: ServerType): Promise<number> =>
  new Promise((resolve) => server.once("listening", () => resolve((server.address() as AddressInfo).port)))

export class InProcessServer {
  readonly clock: FakeClock
  readonly httpUrl: string
  /** Everything the server logged, in order. */
  readonly logs: LogRecord[]
  readonly #logger: ServerLogger
  readonly #server: ServerType
  readonly #database: Database
  readonly #devLogin: DevLogin | undefined
  #databaseOpen = true
  #closed = false

  private constructor(
    server: ServerType,
    database: Database,
    clock: FakeClock,
    port: number,
    logs: LogRecord[],
    logger: ServerLogger,
    devLogin: DevLogin | undefined
  ) {
    this.#server = server
    this.#database = database
    this.#devLogin = devLogin
    this.clock = clock
    this.logs = logs
    this.#logger = logger
    this.httpUrl = `http://127.0.0.1:${port}`
  }

  static async start({
    startAt = TEST_START,
    corsOrigins,
    devLogin,
    webRoot,
    signIn
  }: InProcessOptions = {}): Promise<InProcessServer> {
    const clock = new FakeClock(startAt)
    const database = await pgliteDatabase()
    const logs: LogRecord[] = []
    const logger = createLogger<ServerLogCode>(clock, [(record) => logs.push(record)])
    // Sign-in needs the server's address, known only once it's listening: the app comes after.
    const started: { app?: TaxaApp } = {}
    const server = serve({
      fetch: (request) => (started.app ? started.app.fetch(request) : new Response(undefined, { status: 503 })),
      port: 0,
      hostname: "127.0.0.1"
    })
    const port = await listen(server)
    started.app = await createApp({
      database,
      clock,
      build: "test",
      corsOrigins,
      devLogin,
      webRoot,
      logger,
      signIn: signIn?.(new URL(`http://127.0.0.1:${port}`))
    })
    return new InProcessServer(server, database, clock, port, logs, logger, devLogin)
  }

  /** A person with an API key of their own, who calls the API as themselves. */
  async user(name: string, timeZone: TimeZone = LONDON): Promise<TestUser> {
    return this.#withKey(await createUser(this.#database.db, this.#logger, name, timeZone, this.clock.now()))
  }

  /** The development login's person, as the web app is in browser tests, with an API key too. */
  async devLoginUser(): Promise<TestUser> {
    if (!this.#devLogin) throw new Error("this server has no development login: start it with devLogin")
    const { name, timeZone } = this.#devLogin
    return this.#withKey(await ensureUserNamed(this.#database.db, this.#logger, name, timeZone, this.clock.now()))
  }

  async #withKey(user: CallerUser): Promise<TestUser> {
    const { name } = user
    const now = this.clock.now()
    const caller = { user, agent: undefined, agentContext: undefined }
    const { secret } = await createKey(
      this.#database.db,
      this.#logger,
      caller,
      { name: `${name}'s test key`, agentId: undefined },
      now
    )
    return new TestUser(this.httpUrl, name, secret)
  }

  /** Move the server's clock on, firing whatever falls due. */
  advance(time: Ms): void {
    this.clock.advance(time)
  }

  /** What the daily clear-out of the bin does, now. */
  /** Shares a domain with someone else, as no API does yet. */
  async shareDomain(domainId: DomainId, user: TestUser): Promise<void> {
    const {
      user: { id: userId }
    } = await user.client.me()
    await this.#database.db.insert(domainMembers).values({ domainId, userId })
  }

  clearOldBin(): Promise<number> {
    return clearOldBin(this.#database.db, this.#logger, this.clock.now())
  }

  /** What's stored of a task and its log, seen or not: to check what deleting it for good left. */
  async stored(id: TaskId): Promise<{ title: string; notes: string; tags: string[]; logged: unknown[] }> {
    const db = this.#database.db
    const [row] = await db.select().from(tasks).where(eq(tasks.id, id))
    const log = await db.select({ changes: activity.changes }).from(activity).where(eq(activity.entityId, id))
    return {
      title: row?.title ?? "",
      notes: row?.notes ?? "",
      tags: row?.tags ?? [],
      logged: log.map(({ changes }) => changes)
    }
  }

  /** What's stored of a task's comments and their log, deleted or not. */
  /** The dates of a task's occurrences as stored, taken back or not. */
  async storedOccurrences(taskId: TaskId): Promise<string[]> {
    const rows = await this.#database.db.select().from(occurrences).where(eq(occurrences.taskId, taskId))
    return rows.map(({ date }) => date)
  }

  async storedComments(taskId: TaskId): Promise<{ body: string; logged: unknown[] }[]> {
    const db = this.#database.db
    const rows = await db.select().from(comments).where(eq(comments.taskId, taskId))
    return Promise.all(
      rows.map(async ({ id, body }) => ({
        body,
        logged: (await db.select({ changes: activity.changes }).from(activity).where(eq(activity.entityId, id))).map(
          ({ changes }) => changes
        )
      }))
    )
  }

  async health(): Promise<Health> {
    const response = await fetch(`${this.httpUrl}${HEALTH_PATH}`)
    return HealthSchema.parse(await response.json())
  }

  /** Shut the database, as a lost connection would. */
  async stopDatabase(): Promise<void> {
    this.#databaseOpen = false
    await this.#database.close()
  }

  /** Stop the server and its database; a second call does nothing. */
  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await new Promise((resolve) => this.#server.close(resolve))
    if (this.#databaseOpen) await this.stopDatabase()
  }
}
