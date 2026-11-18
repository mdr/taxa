import { and, eq } from "drizzle-orm"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { DayPlan } from "@taxa/shared/days/day-plan"
import type { TaskId } from "@taxa/shared/ids"
import type { Instant } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { dayPlans } from "../database/schema.ts"
import { findTasksWithIds } from "../tasks/task-store.ts"

/** The order you mean to do a day's tasks in; none yet is an empty one. */
export const getDayPlan = async (db: Db, caller: Caller, date: IsoDate): Promise<DayPlan> => {
  const [row] = await db
    .select()
    .from(dayPlans)
    .where(and(eq(dayPlans.userId, caller.user.id), eq(dayPlans.date, date)))
  return { date, taskIds: row?.taskIds ?? [] }
}

/** Puts a day's tasks in this order, keeping only tasks you can see, each once. */
export const setDayPlan = async (
  db: Db,
  caller: Caller,
  date: IsoDate,
  taskIds: readonly TaskId[],
  now: Instant
): Promise<DayPlan> => {
  const visible = new Set((await findTasksWithIds(db, caller.user.id, taskIds)).map(({ row }) => row.id))
  const kept = [...new Set(taskIds)].filter((id) => visible.has(id))
  const updatedAt = new Date(now)
  await db
    .insert(dayPlans)
    .values({ userId: caller.user.id, date, taskIds: kept, updatedAt })
    .onConflictDoUpdate({ target: [dayPlans.userId, dayPlans.date], set: { taskIds: kept, updatedAt } })
  return { date, taskIds: kept }
}
