import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { ActivityType, type FieldChange } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import type { TaskId } from "@taxa/shared/ids"
import { StoredChecklistItemSchema } from "@taxa/shared/tasks/checklist"
import type { Instant } from "@taxa/shared/units"
import { recordActivity } from "../activity/activity-store.ts"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { activity, domains, tasks } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { stopDeletedTask } from "../sessions/deleted-tasks.ts"
import { Deletion, deletionValues } from "./task-rows.ts"

const itemsOf = (value: unknown): z.infer<typeof StoredChecklistItemSchema>[] => {
  const parsed = z.array(StoredChecklistItemSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}

/**
 * The tasks a change to a checklist made of its items, and those it took
 * back: an item on the checklist before and after, linked to a task in one
 * and not the other. An item added or removed with its link isn't either.
 */
const linksChanged = (change: FieldChange | undefined): { made: TaskId[]; unmade: TaskId[] } => {
  const before = new Map(itemsOf(change?.from).map((item) => [item.id, item]))
  const made: TaskId[] = []
  const unmade: TaskId[] = []
  for (const item of itemsOf(change?.to)) {
    const was = before.get(item.id)
    if (was?.taskId === undefined && item.taskId !== undefined && was) made.push(item.taskId)
    if (was?.taskId !== undefined && item.taskId === undefined) unmade.push(was.taskId)
  }
  return { made, unmade }
}

const refOf = async (tx: Db, id: TaskId): Promise<string> => {
  const [found] = await tx
    .select({ number: tasks.number, prefix: domains.prefix })
    .from(tasks)
    .leftJoin(domains, eq(domains.id, tasks.domainId))
    .where(eq(tasks.id, id))
  return found ? `${found.prefix ?? "IN"}-${found.number}` : "That task"
}

/** Whether nothing's been done to a task since it was made, or brought back by a redo: its last change is that. */
const untouched = async (tx: Db, id: TaskId): Promise<boolean> => {
  const [last] = await tx
    .select({ type: activity.type, changes: activity.changes })
    .from(activity)
    .where(eq(activity.entityId, id))
    .orderBy(desc(activity.sequence))
    .limit(1)
  return (
    last?.type === ActivityType.TASK_CREATED ||
    (last?.type === ActivityType.TASK_RESTORED && last.changes["uncreated"] !== undefined)
  )
}

/** Uncreates a task, or brings one back, as a change of its own in its log. */
const setDeletion = async (tx: Db, caller: Caller, now: Instant, id: TaskId, deletion: Deletion): Promise<void> => {
  const [row] = await tx.select().from(tasks).where(eq(tasks.id, id)).for("update")
  if (!row) return
  const version = row.version + 1
  await tx
    .update(tasks)
    .set({ ...deletionValues(deletion, now), updatedAt: new Date(now), version })
    .where(eq(tasks.id, id))
  const at = new Date(now).toISOString()
  await recordActivity(tx, caller, now, {
    ...(deletion === Deletion.RESTORE
      ? {
          type: ActivityType.TASK_RESTORED,
          changes: { deletedAt: { from: row.deletedAt?.toISOString() }, uncreated: { from: true } }
        }
      : { type: ActivityType.TASK_DELETED, changes: { deletedAt: { to: at }, uncreated: { to: true } } }),
    entityId: id,
    domainId: row.domainId,
    version
  })
  if (deletion !== Deletion.RESTORE) await stopDeletedTask(tx, id, now)
}

/**
 * Undoing a change to a checklist, the tasks it made of items go too, as if
 * never made, unless they've changed since; and those an undo took back
 * come back, redoing it, unless they've been deleted for good since.
 */
export const madeTasksReverted = async (
  tx: Db,
  caller: Caller,
  now: Instant,
  changes: Record<string, FieldChange>
): Promise<void> => {
  const { made, unmade } = linksChanged(changes["checklist"])
  for (const id of made) {
    if (!(await untouched(tx, id)))
      throw new ProblemError(
        ProblemType.VERSION_CONFLICT,
        `${await refOf(tx, id)} has changed since it was made from the checklist, so undoing that would lose it: undo its changes first, or delete it.`
      )
    await setDeletion(tx, caller, now, id, Deletion.UNCREATE)
  }
  for (const id of unmade) {
    const [row] = await tx
      .select({ uncreated: tasks.uncreated, purgedAt: tasks.purgedAt })
      .from(tasks)
      .where(eq(tasks.id, id))
    if (!row?.uncreated) continue
    if (row.purgedAt)
      throw new ProblemError(
        ProblemType.VERSION_CONFLICT,
        `${await refOf(tx, id)} has been deleted for good since, so that can't be redone.`
      )
    await setDeletion(tx, caller, now, id, Deletion.RESTORE)
  }
}
