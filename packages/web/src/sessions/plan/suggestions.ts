import { formatDay } from "@taxa/shared/dates/date-format"
import { addDays, type IsoDate } from "@taxa/shared/dates/plain-date"
import type { TaskId } from "@taxa/shared/ids"
import { Energy, Horizon, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { hasTag } from "@taxa/shared/tasks/tags"

/** Why a task's worth planning in: the first that applies of in progress, overdue or due today, meant for today, due soon, priority, soon, low energy, Inbox. */
export const suggestionReason = (task: Task, today: IsoDate): string | undefined => {
  if (task.status === TaskStatus.IN_PROGRESS) return "In progress"
  if (task.due && task.due < today) return "Overdue"
  if (task.due === today) return "Due today"
  if (task.scheduled && task.scheduled <= today) return "Today"
  if (task.due && task.due <= addDays(today, 6)) return `Due ${formatDay(task.due, today).split(" ")[0]}`
  if (task.priority === Priority.URGENT) return "Urgent"
  if (task.priority === Priority.HIGH) return "High priority"
  if (task.horizon === Horizon.SOON) return "Soon"
  if (task.energy === Energy.LOW) return "Low energy"
  if (task.inbox) return "Inbox"
  return undefined
}

/** Today's tasks, in the order given, then the rest in theirs. */
export const todayFirst = (today: readonly Task[], tasks: readonly Task[]): Task[] => {
  const todays = new Set(today.map(({ id }) => id))
  return [...today, ...tasks.filter(({ id }) => !todays.has(id))]
}

const offered = (task: Task, planned: readonly TaskId[]): boolean =>
  !planned.includes(task.id) && task.status !== TaskStatus.WAITING

/**
 * The tasks to offer for a plan, in the lists' order (in progress first,
 * then most urgent), less those planned and waiting ones; those matching the
 * search, by title or ref, if there is one, and with the tag, if one's chosen.
 */
export const suggestedTasks = (
  tasks: readonly Task[],
  planned: readonly TaskId[],
  search: string,
  tag?: string
): Task[] => {
  const wanted = search.trim().toLowerCase()
  return tasks.filter(
    (task) =>
      offered(task, planned) &&
      (tag === undefined || hasTag(task.tags, tag)) &&
      (wanted === "" || task.title.toLowerCase().includes(wanted) || task.ref.toLowerCase() === wanted)
  )
}

/** The tags on the tasks that could be offered, to narrow them to one: each once, whatever its case, A to Z. */
export const suggestionTags = (tasks: readonly Task[], planned: readonly TaskId[]): string[] => {
  const tags = new Map<string, string>()
  for (const task of tasks) {
    if (!offered(task, planned)) continue
    for (const tag of task.tags) if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag)
  }
  return [...tags.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}
