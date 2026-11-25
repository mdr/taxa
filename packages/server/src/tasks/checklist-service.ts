import { ActivityType, type FieldChange } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import { ChecklistChangeType, type ChecklistRequestSchema } from "@taxa/shared/tasks/checklist"
import type { Task } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import type { z } from "zod"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { ProblemError } from "../http/problem-error.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"
import { changedChecklist, itemIn } from "./checklist-changes.ts"
import { changeTask, insertTask, logCreated, type Applied } from "./task-service.ts"
import { outcomeOf, type TaskState } from "./task-state.ts"
import type { TaskRow } from "./task-rows.ts"

type MakeTask = Extract<z.infer<typeof ChecklistRequestSchema>, { type: ChecklistChangeType.MAKE_TASK }>

interface Made {
  task: Task
  changes: Record<string, FieldChange>
}

/**
 * Makes an item a task of its own, beside this one and following on from it;
 * the item stays, linked to it.
 */
const madeTask = async (
  tx: Db,
  caller: Caller,
  state: TaskState,
  row: TaskRow,
  { item: id, taskId }: MakeTask,
  ref: string,
  now: Instant
): Promise<{ applied: Applied; made: Made }> => {
  const item = itemIn(state.checklist, id, ref)
  if (item.taskId) throw new ProblemError(ProblemType.INVALID_REQUEST, `“${item.text}” is a task of its own already.`)
  const made = await insertTask(
    tx,
    caller,
    { id: taskId, title: item.text, followsOn: row.id, ...(state.domainId && { domain: state.domainId }) },
    now
  )
  const checklist = state.checklist.map((each) => (each === item ? { ...each, taskId: made.task.id } : each))
  return { applied: outcomeOf(state, { ...state, checklist }), made }
}

/** Adds, ticks, rewords or removes an item on a task's checklist, or makes one a task of its own. */
export const changeChecklist = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  ref: string,
  request: z.infer<typeof ChecklistRequestSchema>,
  now: Instant
): Promise<Task> => {
  let made: Made | undefined
  const task = await changeTask(db, log, caller, ref, undefined, now, {
    type: ActivityType.TASK_UPDATED,
    code: LOG_CODES.task.checklistChanged,
    apply: async (state, row, tx) => {
      if (request.type !== ChecklistChangeType.MAKE_TASK)
        return outcomeOf(state, { ...state, checklist: changedChecklist(state.checklist, request, ref, now) })
      const result = await madeTask(tx, caller, state, row, request, ref, now)
      made = result.made
      return result.applied
    }
  })
  if (made) logCreated(log, caller, made.task, made.changes)
  return task
}
