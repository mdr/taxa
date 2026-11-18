import { z } from "zod"
import { IsoDateSchema } from "../dates/plain-date.ts"
import { TaskIdSchema, type TaskId } from "../ids.ts"

export const DAY_PLANS_PATH = "/api/day-plans"

/** The most tasks a day's plan can put in order. */
const MOST_PLANNED = 500

/**
 * The order you mean to do a day's tasks in. Only the order: what's meant for
 * the day is the tasks scheduled for it.
 */
export const DayPlanSchema = z.object({
  date: IsoDateSchema,
  /** First to last; tasks no longer there, or not meant for the day, are passed over. */
  taskIds: z.array(TaskIdSchema)
})

export type DayPlan = z.infer<typeof DayPlanSchema>

export const SetDayPlanRequestSchema = z.object({
  taskIds: z.array(TaskIdSchema).max(MOST_PLANNED)
})

export type SetDayPlanRequest = z.input<typeof SetDayPlanRequestSchema>

/** Tasks in a plan's order, those it doesn't place after them, in the order they came. */
export const inPlanOrder = <T extends { id: TaskId }>(tasks: readonly T[], taskIds: readonly TaskId[]): T[] => {
  const place = new Map(taskIds.map((id, index) => [id, index]))
  const unplaced = taskIds.length
  return tasks
    .map((task, index) => ({ task, rank: place.get(task.id) ?? unplaced + index }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ task }) => task)
}
