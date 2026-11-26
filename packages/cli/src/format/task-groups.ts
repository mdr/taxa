import { addDays, type IsoDate } from "@taxa/shared/dates/plain-date"
import { formatDay } from "@taxa/shared/dates/date-format"
import { checklistProgress, progressText } from "@taxa/shared/tasks/checklist"
import { Horizon, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { cut, shownLength, type Style } from "./style.ts"
import { taskUrl } from "./task-url.ts"

/** The heading a task is listed under, in the order they come. */
enum Group {
  IN_PROGRESS = "In progress",
  WAITING = "Waiting",
  TODAY = "Today",
  TOMORROW = "Tomorrow",
  LATER = "Later",
  SOMEDAY = "Someday",
  FINISHED = "Finished"
}

const ORDER = Object.values(Group)

const isFinished = ({ status }: Task): boolean => status === TaskStatus.DONE || status === TaskStatus.CANCELLED

/** Planned for today or before, or due by then: what today's for. */
const isToday = (task: Task, today: IsoDate): boolean =>
  (task.scheduled !== undefined && task.scheduled <= today) || (task.due !== undefined && task.due <= today)

const groupOf = (task: Task, today: IsoDate): Group => {
  if (isFinished(task)) return Group.FINISHED
  if (task.status === TaskStatus.IN_PROGRESS) return Group.IN_PROGRESS
  if (task.status === TaskStatus.WAITING) return Group.WAITING
  if (isToday(task, today)) return Group.TODAY
  const tomorrow = addDays(today, 1)
  if (task.scheduled === tomorrow || task.due === tomorrow) return Group.TOMORROW
  return task.horizon === Horizon.SOMEDAY ? Group.SOMEDAY : Group.LATER
}

/** Its status, as a mark in front of it. */
export const mark = (task: Task, style: Style): string => {
  switch (task.status) {
    case TaskStatus.IN_PROGRESS:
      return style.amber("◐")
    case TaskStatus.WAITING:
      return style.violet("◔")
    case TaskStatus.DONE:
      return style.green("✓")
    case TaskStatus.CANCELLED:
      return style.dim("✗")
    case TaskStatus.OPEN:
      return style.dim("◯")
  }
}

/** Urgent and high, before the title. */
const priorityMark = (task: Task, style: Style): string => {
  if (task.priority === Priority.URGENT) return `${style.red("‼")} `
  return task.priority === Priority.HIGH ? `${style.orange("!")} ` : ""
}

/** When it's due, in red once it's past, amber on the day. */
const dueText = (due: IsoDate, today: IsoDate, style: Style): string => {
  if (due < today) return style.red(`overdue ${formatDay(due, today)}`)
  return due === today ? style.amber("due today") : `due ${formatDay(due, today)}`
}

/** What its heading doesn't already say, for the column on the right. */
const details = (task: Task, group: Group, today: IsoDate, style: Style): string[] => {
  const scheduledLater = task.scheduled !== undefined && task.scheduled > addDays(today, 1) && group !== Group.FINISHED
  return [
    ...(task.waitingOn ? [style.violet(`on ${task.waitingOn}`)] : []),
    ...(scheduledLater ? [style.dim(formatDay(task.scheduled!, today))] : []),
    ...(task.scheduledTime ? [style.dim(task.scheduledTime)] : []),
    ...(task.due && group !== Group.FINISHED ? [dueText(task.due, today, style)] : []),
    ...(task.checklist.length > 0 ? [style.dim(progressText(checklistProgress(task.checklist)))] : []),
    ...(task.inbox ? [style.cyan("Inbox")] : []),
    ...task.tags.map((tag) => style.cyan(`#${tag}`))
  ]
}

interface LineOptions {
  indent: string
  refWidth: number
  group: Group
  today: IsoDate
  web: string
  style: Style
}

/** One task: its mark, its ref (a link to it), its title, and on the right what else to know, cut to fit. */
const line = (task: Task, { indent, refWidth, group, today, web, style }: LineOptions): string => {
  const right = details(task, group, today, style).join("  ")
  const ref = style.link(taskUrl(web, task.ref), style.dim(task.ref)) + " ".repeat(refWidth - task.ref.length)
  const left = `${indent}${mark(task, style)} ${ref}  ${priorityMark(task, style)}`
  const title = isFinished(task) ? style.dim(task.title) : task.title
  if (style.columns === undefined) return `${left}${title}${right ? `  ${right}` : ""}`
  const room = style.columns - shownLength(left) - (right ? shownLength(right) + 2 : 0)
  const shown = cut(task.title, Math.max(room, 12))
  const fitted = isFinished(task) ? style.dim(shown) : shown
  const gap = Math.max(style.columns - shownLength(left) - shownLength(shown) - shownLength(right), 2)
  return `${left}${fitted}${right ? `${" ".repeat(gap)}${right}` : ""}`.trimEnd()
}

/**
 * Tasks for a person at a terminal: under headings (In progress, Today,
 * Tomorrow, Later, …), most urgent first within each as the server sent
 * them. Search results stay in one list, best matches first.
 */
export const taskGroups = (
  tasks: Task[],
  { today, web, style, grouped }: { today: IsoDate; web: string; style: Style; grouped: boolean }
): string => {
  if (tasks.length === 0) return style.dim("No tasks.")
  const refWidth = Math.max(...tasks.map(({ ref }) => ref.length))
  if (!grouped)
    return tasks
      .map((task) => line(task, { indent: "", refWidth, group: groupOf(task, today), today, web, style }))
      .join("\n")
  return ORDER.flatMap((group) => {
    const members = tasks.filter((task) => groupOf(task, today) === group)
    if (members.length === 0) return []
    const options = { indent: "  ", refWidth, group, today, web, style }
    return [
      [`${style.bold(group)} ${style.dim(String(members.length))}`, ...members.map((task) => line(task, options))].join(
        "\n"
      )
    ]
  }).join("\n\n")
}
