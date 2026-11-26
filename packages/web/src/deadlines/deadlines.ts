import { formatDay } from "@taxa/shared/dates/date-format"
import { addDays, daysBetween, weekdayOf, type IsoDate } from "@taxa/shared/dates/plain-date"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { When, whenOf } from "@taxa/shared/tasks/when"

export const DEADLINES_PATH = "/deadlines"

/** How far ahead a deadline is coming up: due within a week, today included. */
const COMING_UP_DAYS = 7

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
]

export interface DeadlineGroup {
  /** `Overdue`, `Today`, `This week`, `Next week`, then each month: `December`, `January 2027`. */
  name: string
  overdue: boolean
  tasks: Task[]
}

const groupName = (due: IsoDate, today: IsoDate): string => {
  if (due < today) return "Overdue"
  if (due === today) return "Today"
  const sunday = addDays(today, 6 - weekdayOf(today))
  if (due <= sunday) return "This week"
  if (due <= addDays(sunday, 7)) return "Next week"
  const month = MONTHS[Number(due.slice(5, 7)) - 1]!
  return due.slice(0, 4) === today.slice(0, 4) ? month : `${month} ${due.slice(0, 4)}`
}

/** Tasks with due dates, in the order given (soonest due first), under when they're due. */
export const deadlineGroups = (tasks: readonly Task[], today: IsoDate): DeadlineGroup[] => {
  const groups: DeadlineGroup[] = []
  for (const task of tasks) {
    if (!task.due) continue
    const name = groupName(task.due, today)
    const last = groups.at(-1)
    if (last?.name === name) last.tasks.push(task)
    else groups.push({ name, overdue: task.due < today, tasks: [task] })
  }
  return groups
}

const counted = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? "" : "s"}`

const span = (days: number): string => {
  if (days < 14) return counted(days, "day")
  if (days < 60) return counted(Math.round(days / 7), "week")
  return counted(Math.round(days / 30.44), "month")
}

/** How long until a deadline: `today`, `tomorrow`, `in 3 days`, `in 2 months`, or how late: `3 days late`. */
export const countdown = (due: IsoDate, today: IsoDate): string => {
  const days = daysBetween(today, due)
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  return days < 0 ? `${span(-days)} late` : `in ${span(days)}`
}

/** What a coming-up deadline says: `Overdue since Mon 4 Jan`, `Due today`, `Due Fri 9 Jan · in 4 days`. */
export const deadlineReason = (due: IsoDate, today: IsoDate): string => {
  if (due < today) return `Overdue since ${formatDay(due, today)}`
  if (due === today) return "Due today"
  return `Due ${formatDay(due, today)} · ${countdown(due, today)}`
}

/** Whether a task's deadline is overdue or comes within the week. */
export const isComingUp = (task: Task, today: IsoDate): boolean =>
  task.due !== undefined && daysBetween(today, task.due) < COMING_UP_DAYS

/**
 * The deadlines to bring to Today: overdue or due within the week, and not
 * already planned for today, nor waiting on someone else.
 */
export const comingUp = (tasks: readonly Task[], today: IsoDate): Task[] =>
  tasks.filter(
    (task) => isComingUp(task, today) && task.status !== TaskStatus.WAITING && whenOf(task, today) !== When.TODAY
  )
