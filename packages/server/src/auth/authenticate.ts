import { and, eq, isNull } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"
import { createMiddleware } from "hono/factory"
import { ProblemType } from "@taxa/shared/api/problem"
import { TimeZoneSchema } from "@taxa/shared/dates/plain-date"
import { AGENT_CONTEXT_HEADER, TIME_ZONE_HEADER } from "@taxa/shared/identity/actor"
import type { Db } from "../database/database.ts"
import { agents, apiKeys, users } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import type { ServerLogger } from "../telemetry/log.ts"
import { callerUserOf, moveUserTo } from "../users/user-store.ts"
import type { Caller, CallerUser } from "./caller.ts"
import { hashSecret } from "./secrets.ts"
import { getCookie, setCookie } from "hono/cookie"
import type { Context } from "hono"
import type { Clock } from "@taxa/shared/clock"
import type { SignInCookies } from "./sign-in-cookies.ts"
import { findSignIn, SIGN_IN_LAPSES_MS } from "./sign-in-store.ts"

export interface AuthVariables {
  caller: Caller
}

const BEARER = /^Bearer\s+(\S+)$/i

const callerForKey = async (db: Db, secret: string): Promise<Omit<Caller, "agentContext"> | undefined> => {
  const [found] = await db
    .select({ user: users, agent: agents })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .leftJoin(agents, eq(agents.id, apiKeys.agentId))
    .where(and(eq(apiKeys.secretHash, hashSecret(secret)), isNull(apiKeys.revokedAt)))
  if (!found) return undefined
  return {
    user: callerUserOf(found.user),
    agent: found.agent ? { id: found.agent.id, name: found.agent.name } : undefined
  }
}

/**
 * A person calling from somewhere new: they're in the time zone their
 * browser or CLI says, from now on. An agent's is ignored: it may run
 * anywhere, and works in its person's.
 */
const keptUpToDate = async (db: Db, log: ServerLogger, caller: Caller, sent: string | undefined): Promise<Caller> => {
  const parsed = TimeZoneSchema.safeParse(sent)
  if (caller.agent || !parsed.success || parsed.data === caller.user.timeZone) return caller
  return { ...caller, user: await moveUserTo(db, log, caller.user, parsed.data) }
}

/** Signing in through an identity provider, when it's on. */
export interface CookieSignIn {
  cookies: SignInCookies
  clock: Clock
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * The person a browser's signed in as, if it is. A request that changes
 * anything must come from Taxa's own pages, so another site can't make one in
 * their name. A sign-in in use is kept from lapsing, cookie and all.
 */
const signedInCaller = async (
  context: Context,
  db: Db,
  { cookies, clock }: CookieSignIn
): Promise<Omit<Caller, "agentContext"> | undefined> => {
  const secret = getCookie(context, cookies.signIn)
  if (secret === undefined) return undefined
  const found = await findSignIn(db, secret, clock.now())
  if (!found) return undefined
  if (!SAFE_METHODS.has(context.req.method) && !cookies.fromOurPages(context))
    throw new ProblemError(ProblemType.FORBIDDEN, "Changes can only be made from Taxa's own pages.")
  if (found.renewed)
    setCookie(context, cookies.signIn, secret, { ...cookies.attributes, maxAge: SIGN_IN_LAPSES_MS / 1000 })
  return { user: found.user, agent: undefined, signedIn: true }
}

/**
 * Works out who is calling, from an API key, or else the browser's sign-in,
 * or else the development login's person when there is one. `devUser` reads that person fresh each time, so
 * settings they change apply at once. A person's time zone follows the one
 * their requests say they're in.
 */
export const authenticate = (
  db: Db,
  log: ServerLogger,
  devUser: (() => Promise<CallerUser>) | undefined,
  signIn?: CookieSignIn
): MiddlewareHandler<{ Variables: AuthVariables }> =>
  createMiddleware<{ Variables: AuthVariables }>(async (context, next) => {
    const header = context.req.header("authorization")
    const agentContext = context.req.header(AGENT_CONTEXT_HEADER)?.slice(0, 500) || undefined
    const timeZone = context.req.header(TIME_ZONE_HEADER)
    const signed = header === undefined && signIn ? await signedInCaller(context, db, signIn) : undefined
    if (header !== undefined) {
      const secret = BEARER.exec(header)?.[1]
      const caller = secret === undefined ? undefined : await callerForKey(db, secret)
      if (!caller) throw new ProblemError(ProblemType.UNAUTHENTICATED, "That API key isn't valid, or has been revoked.")
      context.set(
        "caller",
        await keptUpToDate(db, log, { ...caller, agentContext: caller.agent ? agentContext : undefined }, timeZone)
      )
    } else if (signed) {
      context.set("caller", await keptUpToDate(db, log, { ...signed, agentContext: undefined }, timeZone))
    } else if (devUser) {
      context.set(
        "caller",
        await keptUpToDate(db, log, { user: await devUser(), agent: undefined, agentContext: undefined }, timeZone)
      )
    } else {
      throw new ProblemError(ProblemType.UNAUTHENTICATED, "Sign in, or send an API key as `Authorization: Bearer …`.")
    }
    await next()
  })
