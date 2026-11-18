import type { TaskId } from "@taxa/shared/ids"
import type { Task } from "@taxa/shared/tasks/task"
import type { TickedTasks } from "./list-session-service.ts"

/**
 * The list's tasks in the order they come, with the ones ticked off since it
 * opened kept in their places, so a tick never makes a task vanish from under
 * you: each goes after the task it came after when last shown, or first.
 */
export const withTicked = (tasks: readonly Task[], ticked: TickedTasks, lastShown: readonly TaskId[]): Task[] => {
  const shown = new Set(tasks.map(({ id }) => id))
  const kept = new Map(
    Object.values(ticked)
      .filter((task): task is Task => task !== undefined && !shown.has(task.id))
      .map((task) => [task.id, task])
  )
  if (kept.size === 0) return [...tasks]
  const merged = [...tasks]
  // In the order they were shown, so each finds the one before it already back in place.
  for (const id of lastShown) {
    const task = kept.get(id)
    if (!task) continue
    const before = [...lastShown.slice(0, lastShown.indexOf(id))]
      .reverse()
      .find((earlier) => merged.some((t) => t.id === earlier))
    merged.splice(before === undefined ? 0 : merged.findIndex((t) => t.id === before) + 1, 0, task)
    kept.delete(id)
  }
  return [...merged, ...kept.values()]
}
