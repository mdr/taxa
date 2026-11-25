import type { CommentId, DomainId, TaskId } from "@taxa/shared/ids"
import { and, asc, eq } from "drizzle-orm"
import type { Activity, ActivityType, FieldChange } from "@taxa/shared/activity/activity"
import type { Instant, Version } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { activity } from "../database/schema.ts"
import { actorsNamed } from "./actor-names.ts"

export interface ActivityRecord {
  type: ActivityType
  entityId: TaskId | DomainId | CommentId
  domainId: DomainId | undefined
  /** The version the change brought it to. */
  version: Version
  undoesVersion?: Version
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

export const activityOf = async (db: Db, entityId: TaskId | DomainId): Promise<Activity[]> => {
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
    version: row.version,
    undoesVersion: row.undoesVersion ?? undefined,
    changes: row.changes
  }))
}

/** The change that brought a task to `version`, if there was one: its type and what it changed. */
export const changeTo = async (
  db: Db,
  entityId: TaskId | CommentId,
  version: Version
): Promise<Pick<ActivityRecord, "type" | "changes"> | undefined> => {
  const [row] = await db
    .select({ type: activity.type, changes: activity.changes })
    .from(activity)
    .where(and(eq(activity.entityId, entityId), eq(activity.version, version)))
  return row
}
