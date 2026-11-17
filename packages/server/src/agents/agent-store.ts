import { agentId, apiKeyId, type AgentId, type ApiKeyId } from "@taxa/shared/ids"
import { and, asc, eq } from "drizzle-orm"
import { ProblemType } from "@taxa/shared/api/problem"
import { uuidv7 } from "@taxa/shared/ids"
import type { Agent, ApiKey, CreatedKey } from "@taxa/shared/identity/agent"
import type { Instant } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import { hashSecret, newSecret, shownPartOf } from "../auth/secrets.ts"
import type { Db } from "../database/database.ts"
import { agents, apiKeys } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { callerFields } from "../telemetry/change-fields.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"

type AgentRow = typeof agents.$inferSelect
type KeyRow = typeof apiKeys.$inferSelect

const agentOf = (row: AgentRow): Agent => ({ id: row.id, name: row.name, createdAt: row.createdAt.toISOString() })

const keyOf = (row: KeyRow): ApiKey => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  ...(row.agentId && { agentId: row.agentId }),
  createdAt: row.createdAt.toISOString(),
  ...(row.revokedAt && { revokedAt: row.revokedAt.toISOString() })
})

/** Agents and keys are managed by people, not by agents. */
const requirePerson = (caller: Caller): void => {
  if (caller.agent) throw new ProblemError(ProblemType.FORBIDDEN, "Only a person can manage agents and API keys.")
}

export const agentsOf = async (db: Db, caller: Caller): Promise<Agent[]> => {
  requirePerson(caller)
  const rows = await db.select().from(agents).where(eq(agents.ownerId, caller.user.id)).orderBy(asc(agents.createdAt))
  return rows.map(agentOf)
}

export const createAgent = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  name: string,
  now: Instant
): Promise<Agent> => {
  requirePerson(caller)
  const [row] = await db
    .insert(agents)
    .values({ id: agentId(uuidv7(now)), ownerId: caller.user.id, name, createdAt: new Date(now) })
    .returning()
  const agent = agentOf(row!)
  log.info(LOG_CODES.agent.created, "agent created", { ...callerFields(caller), createdAgentId: agent.id })
  return agent
}

export const keysOf = async (db: Db, caller: Caller): Promise<ApiKey[]> => {
  requirePerson(caller)
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.userId, caller.user.id)).orderBy(asc(apiKeys.createdAt))
  return rows.map(keyOf)
}

/** A new key for you, or for one of your agents. Its secret is in the answer and nowhere else. */
export const createKey = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  { name, agentId }: { name: string; agentId?: AgentId | undefined },
  now: Instant
): Promise<CreatedKey> => {
  requirePerson(caller)
  if (agentId) {
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.ownerId, caller.user.id)))
    if (!agent) throw new ProblemError(ProblemType.NOT_FOUND, `You have no agent ${agentId}.`)
  }
  const secret = newSecret()
  const [row] = await db
    .insert(apiKeys)
    .values({
      id: apiKeyId(uuidv7(now)),
      userId: caller.user.id,
      agentId,
      name,
      prefix: shownPartOf(secret),
      secretHash: hashSecret(secret),
      createdAt: new Date(now)
    })
    .returning()
  const key = keyOf(row!)
  log.info(LOG_CODES.apiKey.created, "API key created", {
    ...callerFields(caller),
    apiKeyId: key.id,
    keyAgentId: agentId
  })
  return { ...key, secret }
}

export const revokeKey = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  id: ApiKeyId,
  now: Instant
): Promise<ApiKey> => {
  requirePerson(caller)
  const mine = and(eq(apiKeys.id, id), eq(apiKeys.userId, caller.user.id))
  const [existing] = await db.select().from(apiKeys).where(mine)
  if (!existing) throw new ProblemError(ProblemType.NOT_FOUND, `You have no API key ${id}.`)
  if (existing.revokedAt) return keyOf(existing)
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date(now) })
    .where(mine)
    .returning()
  log.info(LOG_CODES.apiKey.revoked, "API key revoked", { ...callerFields(caller), apiKeyId: id })
  return keyOf(row!)
}
