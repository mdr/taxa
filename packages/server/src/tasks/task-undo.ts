import { ActivityType } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import type { Task } from "@taxa/shared/tasks/task"
import type { Instant, Version } from "@taxa/shared/units"
import { changeTo } from "../activity/activity-store.ts"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { ProblemError } from "../http/problem-error.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"
import { changeTask, deletion, restoration, type Applied } from "./task-service.ts"
import { revertedState, RevertType } from "./task-state.ts"
import type { TaskRow } from "./task-rows.ts"
import type { TaskState } from "./task-state.ts"

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
      return { ...undone(change.type, change.changes, state, row, now, ref), undoesVersion: version }
    }
  })

const undone = (
  type: ActivityType,
  changes: Parameters<typeof revertedState>[1],
  state: TaskState,
  row: TaskRow,
  now: Instant,
  ref: string
): Applied => {
  switch (type) {
    case ActivityType.TASK_CREATED:
    case ActivityType.TASK_RESTORED:
      return { ...deletion(state, row, now), type: ActivityType.TASK_DELETED }
    case ActivityType.TASK_DELETED:
      return { ...restoration(state, row), type: ActivityType.TASK_RESTORED }
    case ActivityType.TASK_UPDATED:
    case ActivityType.TASK_STATUS_CHANGED: {
      const reverted = revertedState(state, changes)
      if (reverted.type === RevertType.CHANGED_SINCE)
        throw new ProblemError(
          ProblemType.VERSION_CONFLICT,
          `What that change to ${ref} did has been changed since, so undoing it would lose that: undo the later change first.`
        )
      return reverted.outcome
    }
    case ActivityType.DOMAIN_CREATED:
      throw new ProblemError(ProblemType.INVALID_REQUEST, "That change isn't to a task.")
  }
}
