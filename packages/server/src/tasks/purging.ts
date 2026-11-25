import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import type { DomainId, TaskId } from "@taxa/shared/ids"
import type { Instant } from "@taxa/shared/units"
import type { Db } from "../database/database.ts"
import { activity, comments, idempotencyKeys, occurrences, tasks } from "../database/schema.ts"
import { PURGED_COMMENT } from "../comments/comment-rows.ts"
import { PURGED_ACTIVITY, purgedValues } from "./task-rows.ts"

/**
 * Deletes tasks for good. Their rows stay, so what pointed at them (a
 * follow-on, a session, the log) still names something, but everything
 * written in them, in their comments, or about them in their log, is wiped, and nothing
 * shows them again.
 */
export const purge = async (tx: Db, ids: readonly TaskId[], now: Instant): Promise<void> => {
  if (ids.length === 0) return
  await tx
    .update(tasks)
    .set(purgedValues(now))
    .where(inArray(tasks.id, [...ids]))
  await tx.delete(occurrences).where(inArray(occurrences.taskId, [...ids]))
  const commented = await tx
    .update(comments)
    .set(PURGED_COMMENT)
    .where(inArray(comments.taskId, [...ids]))
    .returning({ id: comments.id })
  await tx
    .update(activity)
    .set(PURGED_ACTIVITY)
    .where(inArray(activity.entityId, [...ids, ...commented.map(({ id }) => id)]))
  // The answers kept for retried requests hold the task, and its comments, as they were made.
  await tx
    .delete(idempotencyKeys)
    .where(inArray(sql`${idempotencyKeys.body}->>'id'`, [...ids, ...commented.map(({ id }) => id)]))
}

/** Deletes for good a domain's tasks uncreated by undos, which aren't in the bin to delete, so it can go. */
export const purgeUncreated = async (tx: Db, domainId: DomainId, now: Instant): Promise<void> => {
  const uncreated = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.domainId, domainId), eq(tasks.uncreated, true), isNull(tasks.purgedAt)))
    .for("update")
  await purge(
    tx,
    uncreated.map(({ id }) => id),
    now
  )
}
