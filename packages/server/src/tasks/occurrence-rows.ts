import type { Actor } from "@taxa/shared/identity/actor"
import type { Occurrence } from "@taxa/shared/tasks/occurrence"
import type { Version } from "@taxa/shared/units"
import type { ActorIds } from "../activity/actor-names.ts"
import type { Caller } from "../auth/caller.ts"
import type { occurrences } from "../database/schema.ts"

type OccurrenceRow = typeof occurrences.$inferSelect
type OccurrenceValues = typeof occurrences.$inferInsert

const byIdsOf = (row: OccurrenceRow): ActorIds => ({
  userId: row.userId,
  agentId: row.agentId ?? undefined,
  agentContext: row.agentContext ?? undefined
})

export const occurrenceActorIds = (rows: readonly OccurrenceRow[]): ActorIds[] => rows.map(byIdsOf)

export const occurrenceOf = (row: OccurrenceRow, actorOf: (ids: ActorIds) => Actor): Occurrence => ({
  id: row.id,
  taskId: row.taskId,
  date: row.date,
  outcome: row.outcome,
  on: row.on,
  at: row.at.toISOString(),
  by: actorOf(byIdsOf(row))
})

/** Who recorded an occurrence, as its row holds them. */
export const recordedBy = (caller: Caller): Pick<OccurrenceValues, "userId" | "agentId" | "agentContext"> => ({
  userId: caller.user.id,
  agentId: caller.agent?.id ?? null,
  agentContext: caller.agentContext ?? null
})

/** An occurrence brought back by redoing it, as of the task's version then. */
export const restoredOccurrence = (taskVersion: Version): Partial<OccurrenceValues> => ({
  voidedAt: null,
  taskVersion
})
