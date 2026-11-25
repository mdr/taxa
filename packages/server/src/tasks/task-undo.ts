import { ActivityType } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import type { Task } from "@taxa/shared/tasks/task"
import type { Instant, Version } from "@taxa/shared/units"
import { changeTo } from "../activity/activity-store.ts"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { ProblemError } from "../http/problem-error.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"
import { changeTask, deletion, restoration, uncreation, type Applied } from "./task-service.ts"
import { revertedState, RevertType } from "./task-state.ts"
import type { TaskRow } from "./task-rows.ts"
import type { TaskState } from "./task-state.ts"
import { occurrencesReverted } from "./repeating.ts"
import { madeTasksReverted } from "./made-tasks.ts"
import { eq } from "drizzle-orm"
import type { DomainId } from "@taxa/shared/ids"
import { domains } from "../database/schema.ts"

/**
 * Takes back the change that brought a task to `version`, whoever made it:
 * a task added is deleted, a deleted one restored, and an edit or a status
 * put back as it was, unless what it changed has changed since. An undo is
 * a change too, so undoing it again redoes what it undid.
 */
export const undoTask = (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  ref: string,
  version: Version,
  now: Instant
): Promise<Task> =>
  changeTask(db, log, caller, ref, undefined, now, {
    type: ActivityType.TASK_UPDATED,
    code: LOG_CODES.task.undone,
    apply: async (state, row, tx) => {
      const change = await changeTo(tx, row.id, version)
      if (!change) throw new ProblemError(ProblemType.NOT_FOUND, `${ref} has no change to version ${version} to undo.`)
      return {
        ...(await undone(tx, caller, change.type, change.changes, { state, row, now, ref })),
        undoesVersion: version
      }
    }
  })

const changedSince = (ref: string): ProblemError =>
  new ProblemError(
    ProblemType.VERSION_CONFLICT,
    `What that change to ${ref} did has been changed since, so undoing it would lose that: undo the later change first.`
  )

/** Puts back what a change did to the task's fields, unless they've changed since. */
const reverted = (state: TaskState, changes: Parameters<typeof revertedState>[1], ref: string): Applied => {
  const result = revertedState(state, changes)
  if (result.type === RevertType.CHANGED_SINCE) throw changedSince(ref)
  return result.outcome
}

/** Fields put back, and the occurrences the change recorded taken back too, or those it took back brought back. */
const withOccurrences = async (
  tx: Db,
  now: Instant,
  row: TaskRow,
  outcome: Applied,
  changes: Parameters<typeof revertedState>[1]
): Promise<Applied> => ({
  ...outcome,
  changes: { ...outcome.changes, ...(await occurrencesReverted(tx, now, row, changes)) }
})

/** Refuses to move a task back into a domain that's been deleted since it left. */
const refuseDeletedDomain = async (
  tx: Db,
  changes: Parameters<typeof revertedState>[1],
  ref: string
): Promise<void> => {
  const from = changes["domainId"]?.from
  if (typeof from !== "string") return
  const [domain] = await tx
    .select({ name: domains.name, deletedAt: domains.deletedAt })
    .from(domains)
    .where(eq(domains.id, from as DomainId))
  if (domain?.deletedAt)
    throw new ProblemError(
      ProblemType.VERSION_CONFLICT,
      `That would put ${ref} back in ${domain.name}, which has been deleted since.`
    )
}

interface Undoing {
  state: TaskState
  row: TaskRow
  now: Instant
  ref: string
}

const undone = async (
  tx: Db,
  caller: Caller,
  type: ActivityType,
  changes: Parameters<typeof revertedState>[1],
  { state, row, now, ref }: Undoing
): Promise<Applied> => {
  switch (type) {
    case ActivityType.TASK_CREATED:
      return { ...uncreation(state, row, now), type: ActivityType.TASK_DELETED }
    case ActivityType.TASK_RESTORED:
      // Redoing what an undo uncreated, undone again, uncreates it again.
      return {
        ...(changes["uncreated"] ? uncreation(state, row, now) : deletion(state, row, now)),
        type: ActivityType.TASK_DELETED
      }
    case ActivityType.TASK_DELETED:
      return { ...restoration(state, row), type: ActivityType.TASK_RESTORED }
    case ActivityType.TASK_UPDATED:
    case ActivityType.TASK_STATUS_CHANGED: {
      await refuseDeletedDomain(tx, changes, ref)
      const outcome = reverted(state, changes, ref)
      // Items made tasks go with them, or come back.
      await madeTasksReverted(tx, caller, now, changes)
      // Either may have caught up missed days too.
      return withOccurrences(tx, now, row, outcome, changes)
    }
    case ActivityType.TASK_OCCURRENCE_RECORDED:
      return {
        ...(await withOccurrences(tx, now, row, reverted(state, changes, ref), changes)),
        type: ActivityType.TASK_OCCURRENCE_UNDONE
      }
    case ActivityType.TASK_OCCURRENCE_UNDONE:
      return {
        ...(await withOccurrences(tx, now, row, reverted(state, changes, ref), changes)),
        type: ActivityType.TASK_OCCURRENCE_RECORDED
      }
    case ActivityType.DOMAIN_CREATED:
    case ActivityType.DOMAIN_DELETED:
    case ActivityType.COMMENT_ADDED:
    case ActivityType.COMMENT_EDITED:
    case ActivityType.COMMENT_DELETED:
    case ActivityType.COMMENT_RESTORED:
      throw new ProblemError(ProblemType.INVALID_REQUEST, "That change isn't to a task.")
  }
}
