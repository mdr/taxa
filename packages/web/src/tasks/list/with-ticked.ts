import { compareTasks } from "@taxa/shared/tasks/task-order"
import type { Task } from "@taxa/shared/tasks/task"

/**
 * The list's tasks, with the ones ticked off since it opened kept in their
 * places, so a tick never makes a task vanish from under you.
 */
export const withTicked = (tasks: readonly Task[], ticked: ReadonlyMap<string, Task>): Task[] => {
  const shown = new Set(tasks.map(({ id }) => id))
  return [...tasks, ...[...ticked.values()].filter(({ id }) => !shown.has(id))].sort(compareTasks)
}
