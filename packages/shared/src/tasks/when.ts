import { daysBetween, type IsoDate } from "../dates/plain-date.ts"
import { formatDay } from "../dates/date-format.ts"
import { caughtUp, type CaughtUp } from "./repeat.ts"
import { Horizon, TaskStatus, type Task } from "./task.ts"
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

/** How long a task can sit in soon before it asks whether it still belongs there. */
const SOON_FOR_DAYS = 28

/**
 * For a task that's been in soon four weeks or more, how many whole weeks:
 * time to ask whether it's still soon, or someday.
 */
export const weeksInSoon = (task: Pick<Task, "horizon" | "horizonSetAt">, today: IsoDate): number | undefined => {
  if (task.horizon !== Horizon.SOON || !task.horizonSetAt) return undefined
  const days = daysBetween(task.horizonSetAt.slice(0, 10), today)
  return days >= SOON_FOR_DAYS ? Math.floor(days / 7) : undefined
}

/** Whether a task scheduled for today was meant for an earlier day, and is still to do. */
export const isCarriedOver = (task: Pick<Task, "scheduled">, today: IsoDate): boolean =>
  task.scheduled !== undefined && task.scheduled < today

/** The days a repeating task that skips them has missed, until its next change records them; none if it's under way. */
export const daysMissed = (
  task: Pick<Task, "scheduled" | "repeat" | "status">,
  today: IsoDate
): CaughtUp | undefined =>
  task.repeat && task.scheduled && task.status === TaskStatus.OPEN
    ? caughtUp(task.repeat, task.scheduled, today)
    : undefined

/** What a row says of a task carried over: from when, or for a repeating one that skips them, the days it's missed. */
export const carriedOverText = (
  task: Pick<Task, "scheduled" | "repeat" | "status">,
  today: IsoDate
): string | undefined => {
  if (task.scheduled === undefined || !isCarriedOver(task, today)) return undefined
  const missed = daysMissed(task, today)?.missed ?? []
  if (missed.length === 0) return `Carried over from ${formatDay(task.scheduled, today)}`
  return missed.length === 1 ? `Missed ${formatDay(missed[0]!, today)}` : `Missed ${missed.length} days`
}

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
