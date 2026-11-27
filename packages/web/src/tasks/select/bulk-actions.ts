import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { OccurrenceOutcome } from "@taxa/shared/tasks/repeat"
import { TaskStatus, type Priority, type Task } from "@taxa/shared/tasks/task"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { When, whenRequest } from "@taxa/shared/tasks/when"
import { setOrClear } from "../changes/field-change.ts"
import { TaskChangeType, type TaskChange } from "../changes/task-changes-service.ts"
import { formatDay } from "@taxa/shared/dates/date-format"
import { WHEN_TEXT } from "../when/when-text.ts"

export enum BulkActionType {
  DONE = "DONE",
  STATUS = "STATUS",
  WHEN = "WHEN",
  DUE = "DUE",
  PRIORITY = "PRIORITY",
  MOVE = "MOVE",
  TAG = "TAG",
  FILE = "FILE",
  DELETE = "DELETE"
}

/** One change, made to every task selected. */
export type BulkAction =
  | { type: BulkActionType.DONE }
  | { type: BulkActionType.STATUS; status: TaskStatus }
  /** A day for On a day; none for the others. */
  | { type: BulkActionType.WHEN; when: When; day?: IsoDate }
  | { type: BulkActionType.DUE; day: IsoDate | undefined }
  | { type: BulkActionType.PRIORITY; priority: Priority }
  | { type: BulkActionType.MOVE; prefix: string; name: string }
  | { type: BulkActionType.TAG; name: string }
  | { type: BulkActionType.FILE }
  | { type: BulkActionType.DELETE }

/** The change an action makes to one task: done, a repeating one is done this time, as its tick does. */
export const changeFor = (action: BulkAction, task: Task, today: IsoDate): TaskChange => {
  switch (action.type) {
    case BulkActionType.DONE:
      return task.repeat
        ? { type: TaskChangeType.OCCURRENCE, request: { outcome: OccurrenceOutcome.DONE } }
        : { type: TaskChangeType.STATUS, request: { status: TaskStatus.DONE } }
    case BulkActionType.STATUS:
      return { type: TaskChangeType.STATUS, request: { status: action.status } }
    case BulkActionType.WHEN:
      return {
        type: TaskChangeType.UPDATE,
        request:
          action.when === When.ON_A_DAY && action.day === undefined
            ? whenRequest(When.ANY_TIME, today)
            : whenRequest(action.when, today, action.day)
      }
    case BulkActionType.DUE:
      return setOrClear(ClearableField.DUE, action.day)
    case BulkActionType.PRIORITY:
      return { type: TaskChangeType.UPDATE, request: { set: { priority: action.priority } } }
    case BulkActionType.MOVE:
      return { type: TaskChangeType.UPDATE, request: { set: { domain: action.prefix } } }
    case BulkActionType.TAG:
      return { type: TaskChangeType.UPDATE, request: { addTags: [action.name] } }
    case BulkActionType.FILE:
      return { type: TaskChangeType.UPDATE, request: { set: { inbox: false } } }
    case BulkActionType.DELETE:
      return { type: TaskChangeType.DELETE }
  }
}

/** The tasks an action applies to: filing, only those in the Inbox. */
export const appliesTo = (action: BulkAction, tasks: readonly Task[]): Task[] =>
  action.type === BulkActionType.FILE ? tasks.filter(({ inbox }) => inbox) : [...tasks]

const tasksText = (count: number): string => `${count} ${count === 1 ? "task" : "tasks"}`

/** What it did, for the notice and the undo history: `Moved 3 tasks to Home`. */
export const bulkLabel = (action: BulkAction, count: number, today: IsoDate): string => {
  const tasks = tasksText(count)
  switch (action.type) {
    case BulkActionType.DONE:
      return `Done: ${tasks}`
    case BulkActionType.STATUS:
      return `${tasks} ${STATUS_TEXT[action.status]}`.replace(/^./, (first) => first.toUpperCase())
    case BulkActionType.WHEN:
      return action.day === undefined
        ? `${tasks}: ${WHEN_TEXT[action.when]}`
        : `${tasks}: on ${formatDay(action.day, today)}`
    case BulkActionType.DUE:
      return action.day === undefined ? `${tasks}: no due date` : `${tasks}: due ${formatDay(action.day, today)}`
    case BulkActionType.PRIORITY:
      return `${tasks}: ${PRIORITY_TEXT[action.priority]} priority`
    case BulkActionType.MOVE:
      return `Moved ${tasks} to ${action.name}`
    case BulkActionType.TAG:
      return `Tagged ${tasks} #${action.name}`
    case BulkActionType.FILE:
      return `Filed ${tasks}`
    case BulkActionType.DELETE:
      return `Deleted ${tasks}`
  }
}
