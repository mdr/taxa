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
import type { Database } from "../database/database.ts"
import type { LogFields } from "../telemetry/log.ts"
import type { CallerUser } from "../auth/caller.ts"
import { createUser, ensureUserNamed } from "../users/user-store.ts"
import { pgliteDatabase } from "./pglite-database.ts"
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
}

export interface LogLine extends LogFields {
  code: string
  msg: string
}

const listen = (server: ServerType): Promise<number> =>
  new Promise((resolve) => server.once("listening", () => resolve((server.address() as AddressInfo).port)))

export class InProcessServer {
  readonly clock: FakeClock
  readonly httpUrl: string
  readonly logLines: LogLine[]
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
    logLines: LogLine[],
    devLogin: DevLogin | undefined
  ) {
    this.#server = server
    this.#database = database
    this.#devLogin = devLogin
    this.clock = clock
    this.logLines = logLines
    this.httpUrl = `http://127.0.0.1:${port}`
  }

  static async start({ startAt = TEST_START, corsOrigins, devLogin }: InProcessOptions = {}): Promise<InProcessServer> {
    const clock = new FakeClock(startAt)
    const database = await pgliteDatabase()
    const logLines: LogLine[] = []
    const app = await createApp({
      database,
      clock,
      build: "test",
      corsOrigins,
      devLogin,
      logEvent: (code, msg, fields) => logLines.push({ code, msg, ...fields })
    })
    const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" })
    return new InProcessServer(server, database, clock, await listen(server), logLines, devLogin)
  }

  /** A person with an API key of their own, who calls the API as themselves. */
  async user(name: string, timeZone: TimeZone = LONDON): Promise<TestUser> {
    return this.#withKey(await createUser(this.#database.db, name, timeZone, this.clock.now()))
  }

  /** The development login's person, as the web app is in browser tests, with an API key too. */
  async devLoginUser(): Promise<TestUser> {
    if (!this.#devLogin) throw new Error("this server has no development login: start it with devLogin")
    const { name, timeZone } = this.#devLogin
    return this.#withKey(await ensureUserNamed(this.#database.db, name, timeZone, this.clock.now()))
  }

  async #withKey(user: CallerUser): Promise<TestUser> {
    const { name } = user
    const now = this.clock.now()
    const caller = { user, agent: undefined, agentContext: undefined }
    const { secret } = await createKey(
      this.#database.db,
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
