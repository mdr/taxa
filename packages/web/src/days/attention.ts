import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { Horizon, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { When, whenOf } from "@taxa/shared/tasks/when"

export interface Attention {
  task: Task
  /** Why: `Overdue since Mon 4 Jan`, `Due today`, `Soon · urgent`. */
  reason: string
}

const reasonFor = (task: Task, today: IsoDate): string | undefined => {
  if (task.due && task.due < today) return `Overdue since ${formatDay(task.due, today)}`
  if (task.due === today) return "Due today"
  if (task.horizon === Horizon.SOON && task.priority === Priority.URGENT) return "Soon · urgent"
  return undefined
}

/**
 * What isn't planned for today but might want to be: due or overdue, or
 * urgent and lined up for soon; overdue longest first. Not what's waiting
 * on others, nor what's planned for another day.
 */
export const needingAttention = (tasks: readonly Task[], today: IsoDate): Attention[] =>
  tasks
    .filter((task) => task.status !== TaskStatus.WAITING && whenOf(task, today) !== When.TODAY)
    .filter((task) => whenOf(task, today) !== When.ON_A_DAY || (task.due !== undefined && task.due <= today))
    .flatMap((task) => {
      const reason = reasonFor(task, today)
      return reason ? [{ task, reason }] : []
    })
    .sort((a, b) => (a.task.due ?? "9999-12-31").localeCompare(b.task.due ?? "9999-12-31"))
