import type { IsoDate } from "../dates/plain-date.ts"
import { Horizon, type Task } from "./task.ts"
import { ClearableField, type UpdateTaskRequest } from "./task-requests.ts"

/**
 * When a task's meant to be done, as one choice: today, on a day to come,
 * soon, someday, or any time (no plan at all). Today and a day to come are
 * its scheduled date; soon and someday, its horizon.
 */
export enum When {
  TODAY = "TODAY",
  ON_A_DAY = "ON_A_DAY",
  SOON = "SOON",
  ANY_TIME = "ANY_TIME",
  SOMEDAY = "SOMEDAY"
}

/**
 * Which of those a task is. Scheduled for today or a day gone by, it's
 * today's, still there until it's done; for a day to come, on that day. A
 * date beats a horizon.
 */
export const whenOf = (task: Pick<Task, "scheduled" | "horizon">, today: IsoDate): When => {
  if (task.scheduled) return task.scheduled <= today ? When.TODAY : When.ON_A_DAY
  if (task.horizon === Horizon.SOON) return When.SOON
  if (task.horizon === Horizon.SOMEDAY) return When.SOMEDAY
  return When.ANY_TIME
}

/** Every When but someday: what lists show unless asked for more. */
export const DEFAULT_WHENS: readonly When[] = [When.TODAY, When.ON_A_DAY, When.SOON, When.ANY_TIME]

/** Whether a task scheduled for today was meant for an earlier day, and is still to do. */
export const isCarriedOver = (task: Pick<Task, "scheduled">, today: IsoDate): boolean =>
  task.scheduled !== undefined && task.scheduled < today

/**
 * The change that makes a task's When the one chosen: a date or a horizon,
 * and the other cleared, so only one says when. A day to come needs its date.
 */
export const whenRequest = (when: When, today: IsoDate, day?: IsoDate): UpdateTaskRequest => {
  const undated = [ClearableField.SCHEDULED, ClearableField.SCHEDULED_TIME]
  switch (when) {
    case When.TODAY:
      return { set: { scheduled: today }, clear: [ClearableField.HORIZON] }
    case When.ON_A_DAY:
      return { set: { scheduled: day ?? today }, clear: [ClearableField.HORIZON] }
    case When.SOON:
      return { set: { horizon: Horizon.SOON }, clear: undated }
    case When.SOMEDAY:
      return { set: { horizon: Horizon.SOMEDAY }, clear: undated }
    case When.ANY_TIME:
      return { clear: [...undated, ClearableField.HORIZON] }
  }
}
