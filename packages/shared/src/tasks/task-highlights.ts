import { formatDay } from "../dates/date-format.ts"
import type { IsoDate } from "../dates/plain-date.ts"
import { Priority, TaskStatus, type Task } from "./task.ts"
import { PRIORITY_TEXT, STATUS_TEXT } from "./task-text.ts"

/** What sets a task apart at a glance in a list: status if not open, priority if not normal, dates. */
export const taskHighlights = (task: Task, today: IsoDate): string[] => [
  ...(task.status === TaskStatus.OPEN ? [] : [STATUS_TEXT[task.status]]),
  ...(task.waitingOn ? [`on ${task.waitingOn}`] : []),
  ...(task.priority === Priority.NORMAL ? [] : [PRIORITY_TEXT[task.priority]]),
  ...(task.due ? [`due ${formatDay(task.due, today)}`] : []),
  ...(task.scheduled
    ? [`scheduled ${formatDay(task.scheduled, today)}${task.scheduledTime ? ` ${task.scheduledTime}` : ""}`]
    : []),
  ...(task.inbox ? ["inbox"] : [])
]
