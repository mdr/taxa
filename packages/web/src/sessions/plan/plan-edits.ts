import type { TaskId } from "@taxa/shared/ids"
import type { Minutes } from "@taxa/shared/units"

/** A task in a plan, with the time planned for it: whatever else the plan keeps about it is carried along. */
export interface PlanEntry {
  taskId: TaskId
  minutes: Minutes
}

/** The plan with the task put in at a place (the end, unless given), unless it's in already. */
export const addEntry = <Entry extends PlanEntry>(
  plan: readonly Entry[],
  entry: Entry,
  at: number = plan.length
): Entry[] => {
  if (plan.some(({ taskId }) => taskId === entry.taskId)) return [...plan]
  const place = Math.max(0, Math.min(at, plan.length))
  return [...plan.slice(0, place), entry, ...plan.slice(place)]
}

export const removeEntry = <Entry extends PlanEntry>(plan: readonly Entry[], taskId: TaskId): Entry[] =>
  plan.filter((entry) => entry.taskId !== taskId)

/** The task taken out and put back at a place, as dragging it there does. */
export const moveEntry = <Entry extends PlanEntry>(plan: readonly Entry[], taskId: TaskId, to: number): Entry[] => {
  const from = plan.findIndex((entry) => entry.taskId === taskId)
  if (from < 0) return [...plan]
  const moved = plan.filter((_, index) => index !== from)
  const place = Math.max(0, Math.min(to, moved.length))
  return [...moved.slice(0, place), plan[from]!, ...moved.slice(place)]
}

export const setMinutes = <Entry extends PlanEntry>(
  plan: readonly Entry[],
  taskId: TaskId,
  minutes: Minutes
): Entry[] => plan.map((entry) => (entry.taskId === taskId ? { ...entry, minutes } : entry))

export const totalMinutes = (plan: readonly PlanEntry[]): Minutes =>
  plan.reduce((total, { minutes }) => total + minutes, 0)

/** What a task added to a plan gets: its estimate, or half an hour. */
export const DEFAULT_MINUTES: Minutes = 30
