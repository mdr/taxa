import type { TaskId } from "@taxa/shared/ids"
import type { Minutes } from "@taxa/shared/units"

/** A task in a plan, with the time planned for it: whatever else the plan keeps about it is carried along. */
export interface PlanEntry {
  taskId: TaskId
  minutes: Minutes
}

export enum Direction {
  UP = "UP",
  DOWN = "DOWN"
}

/** The plan with the task added at the end, unless it's in already. */
export const addEntry = <Entry extends PlanEntry>(plan: readonly Entry[], entry: Entry): Entry[] =>
  plan.some(({ taskId }) => taskId === entry.taskId) ? [...plan] : [...plan, entry]

export const removeEntry = <Entry extends PlanEntry>(plan: readonly Entry[], taskId: TaskId): Entry[] =>
  plan.filter((entry) => entry.taskId !== taskId)

/** The task swapped with its neighbour, if it has one that way. */
export const moveEntry = <Entry extends PlanEntry>(
  plan: readonly Entry[],
  taskId: TaskId,
  direction: Direction
): Entry[] => {
  const from = plan.findIndex((entry) => entry.taskId === taskId)
  const to = direction === Direction.UP ? from - 1 : from + 1
  if (from < 0 || to < 0 || to >= plan.length) return [...plan]
  const moved = [...plan]
  ;[moved[from], moved[to]] = [moved[to]!, moved[from]!]
  return moved
}

export const setMinutes = <Entry extends PlanEntry>(
  plan: readonly Entry[],
  taskId: TaskId,
  minutes: Minutes
): Entry[] => plan.map((entry) => (entry.taskId === taskId ? { ...entry, minutes } : entry))

export const totalMinutes = (plan: readonly PlanEntry[]): Minutes =>
  plan.reduce((total, { minutes }) => total + minutes, 0)

/** The times offered for a task: common lengths, and whatever it has now. */
export const minuteChoices = (current: Minutes): Minutes[] =>
  [...new Set([5, 10, 15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180, 240, current])].sort((a, b) => a - b)

/** What a task added to a plan gets: its estimate, or half an hour. */
export const DEFAULT_MINUTES: Minutes = 30
