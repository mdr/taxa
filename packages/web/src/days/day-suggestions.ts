import { addDays, type IsoDate } from "@taxa/shared/dates/plain-date"
import type { TaskId } from "@taxa/shared/ids"
import { Horizon, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { When, whenOf } from "@taxa/shared/tasks/when"

/**
 * How strongly a task asks to be done today, strongest first: due now, under
 * way, lined up for soon, due this week, important. Nothing, for the rest.
 */
const pull = (task: Task, today: IsoDate): number | undefined => {
  if (task.due && task.due <= today) return 0
  if (task.status === TaskStatus.IN_PROGRESS) return 1
  if (task.horizon === Horizon.SOON) return 2
  if (task.due && task.due <= addDays(today, 6)) return 3
  if (task.priority === Priority.URGENT || task.priority === Priority.HIGH) return 4
  return undefined
}

/**
 * The tasks to offer for today, strongest pull first, then in the lists'
 * order; not those meant for today already or another day, nor those
 * waiting. Searching, any of the rest whose title or ref matches.
 */
export const daySuggestions = (
  tasks: readonly Task[],
  today: IsoDate,
  planned: readonly TaskId[],
  search: string
): Task[] => {
  const wanted = search.trim().toLowerCase()
  const open = tasks.filter(
    (task) =>
      !planned.includes(task.id) &&
      task.status !== TaskStatus.WAITING &&
      whenOf(task, today) !== When.TODAY &&
      (wanted !== "" || whenOf(task, today) !== When.ON_A_DAY)
  )
  if (wanted !== "")
    return open.filter((task) => task.title.toLowerCase().includes(wanted) || task.ref.toLowerCase() === wanted)
  return open
    .map((task, index) => ({ task, index, pull: pull(task, today) }))
    .filter((suggestion): suggestion is { task: Task; index: number; pull: number } => suggestion.pull !== undefined)
    .sort((a, b) => a.pull - b.pull || a.index - b.index)
    .map(({ task }) => task)
}
