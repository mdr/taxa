import { inArray } from "drizzle-orm"
import type { Actor } from "@taxa/shared/identity/actor"
import type { Db } from "../database/database.ts"
import { agents, users } from "../database/schema.ts"

/** The ids of an actor, as rows hold them. */
export interface ActorIds {
  userId: string
  agentId: string | undefined
  agentContext: string | undefined
}

/** Turns actors' ids into names, looking each person and agent up once. */
export const actorsNamed = async (db: Db, ids: readonly ActorIds[]): Promise<(ids: ActorIds) => Actor> => {
  const userIds = [...new Set(ids.map((actor) => actor.userId))]
  const agentIds = [...new Set(ids.flatMap((actor) => (actor.agentId ? [actor.agentId] : [])))]
  const userRows = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : []
  const agentRows = agentIds.length ? await db.select().from(agents).where(inArray(agents.id, agentIds)) : []
  const userNames = new Map(userRows.map((row) => [row.id, row.name]))
  const agentNames = new Map(agentRows.map((row) => [row.id, row.name]))
  return ({ userId, agentId, agentContext }) => ({
    user: { id: userId, name: userNames.get(userId) ?? "Unknown" },
    ...(agentId && { agent: { id: agentId, name: agentNames.get(agentId) ?? "Unknown" } }),
    ...(agentContext && { agentContext })
  })
}
