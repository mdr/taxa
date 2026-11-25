import { z } from "zod"
import { addDays, daysBetween, IsoDateSchema, weekdayOf, type IsoDate } from "../dates/plain-date.ts"

export enum RepeatUnit {
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
  YEAR = "YEAR"
}

/** Whether it comes round on a schedule, or a while after it was last done. */
export enum RepeatFrom {
  SCHEDULE = "SCHEDULE",
  COMPLETION = "COMPLETION"
}

/** In order, Monday first, as `weekdayOf` counts them. */
/** What becomes of the days that go by while it isn't done. */
export enum MissedDays {
  /** It stays, overdue, until it's done; done late, it's the one occurrence. */
  CARRY_OVER = "CARRY_OVER",
  /** Each is recorded as missed, and it moves on to today, or the next time it comes round. */
  SKIP = "SKIP"
}

export enum Weekday {
  MONDAY = "MONDAY",
  TUESDAY = "TUESDAY",
  WEDNESDAY = "WEDNESDAY",
  THURSDAY = "THURSDAY",
  FRIDAY = "FRIDAY",
  SATURDAY = "SATURDAY",
  SUNDAY = "SUNDAY"
}

export const WEEKDAYS: readonly Weekday[] = Object.values(Weekday)

const WORKING_DAYS: readonly Weekday[] = WEEKDAYS.slice(0, 5)

const MAX_EVERY = 99

const RepeatFieldsSchema = z.object({
  /** Every this many units. */
  every: z.number().int().min(1).max(MAX_EVERY),
  unit: z.enum(RepeatUnit),
  from: z.enum(RepeatFrom),
  /** Weekly on a schedule: the days of the week; by default, the start date's. */
  weekdays: z.array(z.enum(Weekday)).min(1).max(7).optional(),
  /** Monthly on a schedule: the day of the month, or the month's last day if it's shorter; by default, the start date's. */
  monthDay: z.number().int().min(1).max(31).optional(),
  /** What becomes of days missed; by default, skipped if it's daily on a schedule, otherwise carried over. */
  missed: z.enum(MissedDays).optional()
})

type RepeatFields = z.infer<typeof RepeatFieldsSchema>

const scheduleOnly = (repeat: RepeatFields, context: z.RefinementCtx): void => {
  if (repeat.weekdays && !(repeat.unit === RepeatUnit.WEEK && repeat.from === RepeatFrom.SCHEDULE))
    context.addIssue({ code: "custom", message: "weekdays are for repeating weekly on a schedule" })
  if (repeat.monthDay !== undefined && !(repeat.unit === RepeatUnit.MONTH && repeat.from === RepeatFrom.SCHEDULE))
    context.addIssue({ code: "custom", message: "monthDay is for repeating monthly on a schedule" })
}

/** How a task repeats, as asked for: the server fills in what's left out. */
export const RepeatRequestSchema = RepeatFieldsSchema.extend({
  /** The date it counts from; by default, the task's scheduled date, or today. */
  starts: IsoDateSchema.optional()
}).superRefine(scheduleOnly)

export type RepeatRequest = z.input<typeof RepeatRequestSchema>

/** How a task repeats: every field filled in. */
export const RepeatSchema = RepeatFieldsSchema.extend({
  /** The date it counts from, so moving one occurrence doesn't shift the rest. */
  starts: IsoDateSchema
}).superRefine(scheduleOnly)

export type Repeat = z.infer<typeof RepeatSchema>

/** What happened to an occurrence. */
export enum OccurrenceOutcome {
  DONE = "DONE",
  SKIPPED = "SKIPPED",
  MISSED = "MISSED"
}

const parts = (date: IsoDate): { year: number; month: number; day: number } => {
  const [year, month, day] = date.split("-").map(Number)
  return { year: year!, month: month!, day: day! }
}

const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()

const dateOf = (year: number, month: number, day: number): IsoDate =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(day, daysInMonth(year, month))).padStart(2, "0")}`

/** A month on, or `months`: the same day, or the month's last if it's shorter. */
const addMonths = (date: IsoDate, months: number, day = parts(date).day): IsoDate => {
  const { year, month } = parts(date)
  const index = year * 12 + month - 1 + months
  return dateOf(Math.floor(index / 12), (index % 12) + 1, day)
}

const defaultMissedDays = ({ unit, from }: Pick<RepeatRequest, "unit" | "from">): MissedDays =>
  unit === RepeatUnit.DAY && from === RepeatFrom.SCHEDULE ? MissedDays.SKIP : MissedDays.CARRY_OVER

const weekdayName = (date: IsoDate): Weekday => WEEKDAYS[weekdayOf(date)]!

/**
 * How a task repeats, every field filled in: counted from `starts`, weekly on
 * its day of the week and monthly on its day of the month unless they're
 * given. Its fields always in the same order, so it compares as JSON.
 */
export const repeatOf = (request: RepeatRequest, starts: IsoDate): Repeat => {
  const from = request.starts ?? starts
  const onSchedule = request.from === RepeatFrom.SCHEDULE
  const weekdays =
    onSchedule && request.unit === RepeatUnit.WEEK
      ? WEEKDAYS.filter((day) => (request.weekdays ?? [weekdayName(from)]).includes(day))
      : undefined
  const monthDay = onSchedule && request.unit === RepeatUnit.MONTH ? (request.monthDay ?? parts(from).day) : undefined
  return {
    every: request.every,
    unit: request.unit,
    from: request.from,
    ...(weekdays && { weekdays }),
    ...(monthDay !== undefined && { monthDay }),
    missed: request.missed ?? defaultMissedDays(request),
    starts: from
  }
}

/** What becomes of its missed days: as set, or for a rule from before there was a choice, the default. */
export const missedDaysOf = (repeat: Repeat): MissedDays => repeat.missed ?? defaultMissedDays(repeat)

/** Whether a repeat on a schedule comes round on `date`. */
const comesRoundOn = (repeat: Repeat, date: IsoDate): boolean => {
  if (date < repeat.starts) return false
  const start = parts(repeat.starts)
  const day = parts(date)
  switch (repeat.unit) {
    case RepeatUnit.DAY:
      return daysBetween(repeat.starts, date) % repeat.every === 0
    case RepeatUnit.WEEK: {
      const weeks = Math.floor(daysBetween(addDays(repeat.starts, -weekdayOf(repeat.starts)), date) / 7)
      return weeks % repeat.every === 0 && (repeat.weekdays ?? []).includes(weekdayName(date))
    }
    case RepeatUnit.MONTH: {
      const months = (day.year - start.year) * 12 + day.month - start.month
      return months % repeat.every === 0 && date === dateOf(day.year, day.month, repeat.monthDay ?? start.day)
    }
    case RepeatUnit.YEAR:
      return (
        (day.year - start.year) % repeat.every === 0 &&
        day.month === start.month &&
        date === dateOf(day.year, start.month, start.day)
      )
  }
}

/** The longest a schedule can go between occurrences, in days, with room to spare. */
const longestGap = (repeat: Repeat): number => {
  switch (repeat.unit) {
    case RepeatUnit.DAY:
      return repeat.every
    case RepeatUnit.WEEK:
      return 7 * repeat.every + 7
    case RepeatUnit.MONTH:
      return 31 * repeat.every + 31
    case RepeatUnit.YEAR:
      return 366 * repeat.every + 366
  }
}

/** The first day after `date` that a repeat on a schedule comes round. */
const nextOnSchedule = (repeat: Repeat, date: IsoDate): IsoDate => {
  const from = date < repeat.starts ? addDays(repeat.starts, -1) : date
  const last = longestGap(repeat)
  for (let days = 1; days <= last; days++) {
    const next = addDays(from, days)
    if (comesRoundOn(repeat, next)) return next
  }
  throw new Error(`No occurrence within ${last} days of ${from}`)
}

/** `every` units on from `date`. */
const afterInterval = (repeat: Repeat, date: IsoDate): IsoDate => {
  switch (repeat.unit) {
    case RepeatUnit.DAY:
      return addDays(date, repeat.every)
    case RepeatUnit.WEEK:
      return addDays(date, 7 * repeat.every)
    case RepeatUnit.MONTH:
      return addMonths(date, repeat.every)
    case RepeatUnit.YEAR:
      return addMonths(date, 12 * repeat.every)
  }
}

/** The first day on or after `date` that it comes round: for a repeating task with no date yet. */
export const firstOccurrence = (repeat: Repeat, date: IsoDate): IsoDate =>
  repeat.from === RepeatFrom.SCHEDULE ? nextOnSchedule(repeat, addDays(date, -1)) : date

/** The most missed days caught up at once, the latest: enough to show, without a year's worth. */
const MOST_MISSED = 100

export interface CaughtUp {
  /** The days it came round and went by, oldest first. */
  missed: IsoDate[]
  /** The day it's for now: the latest it's come round, today for a daily one. */
  next: IsoDate
}

/**
 * For a repeating task that skips missed days, those that went by while it
 * was at `scheduled`, each missed once the next has come round, and the day
 * it's for now, the latest that has; undefined if it carries them over, or
 * none have been missed.
 */
export const caughtUp = (repeat: Repeat, scheduled: IsoDate, today: IsoDate): CaughtUp | undefined => {
  if (scheduled >= today || missedDaysOf(repeat) !== MissedDays.SKIP) return undefined
  if (repeat.from === RepeatFrom.COMPLETION) return { missed: [scheduled], next: today }
  const missed = [scheduled]
  let next = nextOnSchedule(repeat, scheduled)
  if (next > today) return undefined
  for (; nextOnSchedule(repeat, next) <= today; next = nextOnSchedule(repeat, next)) missed.push(next)
  return { missed: missed.slice(-MOST_MISSED), next }
}

export interface Occurred {
  /** The date the occurrence was for: the task's scheduled date. */
  scheduled: IsoDate
  today: IsoDate
  outcome: OccurrenceOutcome
}

/**
 * When it next comes round, once an occurrence is done or skipped: on a
 * schedule, the first time after both the date it was for and today, so
 * doing Monday's on Sunday makes the next Tuesday; from completion, the
 * interval after it was done (or, skipped, after the later of its date and
 * today).
 */
export const nextOccurrence = (repeat: Repeat, { scheduled, today, outcome }: Occurred): IsoDate => {
  const later = scheduled > today ? scheduled : today
  if (repeat.from === RepeatFrom.SCHEDULE) return nextOnSchedule(repeat, later)
  return afterInterval(repeat, outcome === OccurrenceOutcome.DONE ? today : later)
}

const WEEKDAY_TEXT: Record<Weekday, string> = {
  [Weekday.MONDAY]: "Monday",
  [Weekday.TUESDAY]: "Tuesday",
  [Weekday.WEDNESDAY]: "Wednesday",
  [Weekday.THURSDAY]: "Thursday",
  [Weekday.FRIDAY]: "Friday",
  [Weekday.SATURDAY]: "Saturday",
  [Weekday.SUNDAY]: "Sunday"
}

const UNIT_TEXT: Record<RepeatUnit, [string, string]> = {
  [RepeatUnit.DAY]: ["day", "days"],
  [RepeatUnit.WEEK]: ["week", "weeks"],
  [RepeatUnit.MONTH]: ["month", "months"],
  [RepeatUnit.YEAR]: ["year", "years"]
}

const MONTH_TEXT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** 1st, 2nd, 3rd, 4th, … 21st. */
export const ordinal = (n: number): string => {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")
  return `${n}${suffix}`
}

const listed = (words: readonly string[]): string =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`

const isWorkingWeek = (weekdays: readonly Weekday[]): boolean =>
  weekdays.length === WORKING_DAYS.length && WORKING_DAYS.every((day) => weekdays.includes(day))

/** Weekly on a schedule: `Every weekday`, `Every Monday and Thursday`, `Every 2 weeks on Friday`. */
const weeklyText = (repeat: Repeat, every: string): string => {
  const weekdays = repeat.weekdays ?? []
  if (repeat.every === 1 && isWorkingWeek(weekdays)) return "Every weekday"
  if (weekdays.length === 7) return repeat.every === 1 ? "Every day" : `${every}, every day`
  const days = listed(weekdays.map((day) => WEEKDAY_TEXT[day]))
  return repeat.every === 1 ? `Every ${days}` : `${every} on ${days}`
}

/** How it repeats, in a few words: `Every day`, `Every Monday and Thursday`, `3 days after it's done`. */
export const repeatText = (repeat: Repeat): string => {
  const [one, many] = UNIT_TEXT[repeat.unit]
  const units = repeat.every === 1 ? one : `${repeat.every} ${many}`
  if (repeat.from === RepeatFrom.COMPLETION) return `${repeat.every === 1 ? `A ${one}` : units} after it's done`
  const every = `Every ${units}`
  switch (repeat.unit) {
    case RepeatUnit.DAY:
      return every
    case RepeatUnit.WEEK:
      return weeklyText(repeat, every)
    case RepeatUnit.MONTH: {
      const on = `on the ${ordinal(repeat.monthDay ?? parts(repeat.starts).day)}`
      return repeat.every === 1 ? `Monthly ${on}` : `${every} ${on}`
    }
    case RepeatUnit.YEAR: {
      const { month, day } = parts(repeat.starts)
      const on = `on ${day} ${MONTH_TEXT[month - 1]}`
      return repeat.every === 1 ? `Every year ${on}` : `${every} ${on}`
    }
  }
}
