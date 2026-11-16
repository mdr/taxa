import { and, eq, isNull } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"
import { createMiddleware } from "hono/factory"
import { ProblemType } from "@taxa/shared/api/problem"
import { AGENT_CONTEXT_HEADER } from "@taxa/shared/identity/actor"
import type { Db } from "../database/database.ts"
import { agents, apiKeys, users } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { callerUserOf } from "../users/user-store.ts"
import type { Caller, CallerUser } from "./caller.ts"
import { hashSecret } from "./secrets.ts"

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
 * Works out who is calling, from an API key, or else the development login's
 * person when there is one. `devUser` reads that person fresh each time, so
 * settings they change apply at once.
 */
export const authenticate = (
  db: Db,
  devUser: (() => Promise<CallerUser>) | undefined
): MiddlewareHandler<{ Variables: AuthVariables }> =>
  createMiddleware<{ Variables: AuthVariables }>(async (context, next) => {
    const header = context.req.header("authorization")
    const agentContext = context.req.header(AGENT_CONTEXT_HEADER)?.slice(0, 500) || undefined
    if (header !== undefined) {
      const secret = BEARER.exec(header)?.[1]
      const caller = secret === undefined ? undefined : await callerForKey(db, secret)
      if (!caller) throw new ProblemError(ProblemType.UNAUTHENTICATED, "That API key isn't valid, or has been revoked.")
      context.set("caller", { ...caller, agentContext: caller.agent ? agentContext : undefined })
    } else if (devUser) {
      context.set("caller", { user: await devUser(), agent: undefined, agentContext: undefined })
    } else {
      throw new ProblemError(ProblemType.UNAUTHENTICATED, "Sign in, or send an API key as `Authorization: Bearer …`.")
    }
    await next()
  })
