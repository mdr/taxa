import { asc, eq } from "drizzle-orm"
import type { Activity, ActivityType, FieldChange } from "@taxa/shared/activity/activity"
import type { Instant } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { activity } from "../database/schema.ts"
import { actorsNamed } from "./actor-names.ts"

export interface ActivityRecord {
  type: ActivityType
  entityId: string
  domainId: string
  changes: Record<string, FieldChange>
}

export const recordActivity = async (db: Db, caller: Caller, at: Instant, record: ActivityRecord): Promise<void> => {
  await db.insert(activity).values({
    at: new Date(at),
    userId: caller.user.id,
    agentId: caller.agent?.id,
    agentContext: caller.agentContext,
    ...record
  })
}

export const activityOf = async (db: Db, entityId: string): Promise<Activity[]> => {
  const rows = await db.select().from(activity).where(eq(activity.entityId, entityId)).orderBy(asc(activity.sequence))
  const ids = rows.map((row) => ({
    userId: row.userId,
    agentId: row.agentId ?? undefined,
    agentContext: row.agentContext ?? undefined
  }))
  const actorOf = await actorsNamed(db, ids)
  return rows.map((row, i) => ({
    sequence: row.sequence,
    at: row.at.toISOString(),
    actor: actorOf(ids[i]!),
    type: row.type,
    changes: row.changes
  }))
}
