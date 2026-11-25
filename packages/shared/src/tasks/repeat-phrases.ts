import { RepeatFrom, RepeatUnit, WEEKDAYS, type RepeatRequest, type Weekday } from "./repeat.ts"

/** Some of the phrases understood, for help and errors. */
export const REPEAT_EXAMPLES = [
  "daily",
  "every 2 days",
  "every weekday",
  "weekly",
  "every monday and thursday",
  "every 2 weeks on friday",
  "monthly",
  "monthly on the 1st",
  "every 3 months on the 15th",
  "yearly",
  "3 days after done"
] as const

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }

const UNITS: Record<string, RepeatUnit> = {
  day: RepeatUnit.DAY,
  days: RepeatUnit.DAY,
  week: RepeatUnit.WEEK,
  weeks: RepeatUnit.WEEK,
  month: RepeatUnit.MONTH,
  months: RepeatUnit.MONTH,
  year: RepeatUnit.YEAR,
  years: RepeatUnit.YEAR
}

const ADVERBS: Record<string, RepeatUnit> = {
  daily: RepeatUnit.DAY,
  weekly: RepeatUnit.WEEK,
  fortnightly: RepeatUnit.WEEK,
  monthly: RepeatUnit.MONTH,
  yearly: RepeatUnit.YEAR,
  annually: RepeatUnit.YEAR
}

const weekdayFor = (word: string): Weekday | undefined =>
  word.length >= 2 ? WEEKDAYS.find((day) => day.toLowerCase().startsWith(word.replace(/s$/, ""))) : undefined

/** A count: `2`, `two`, `a`. */
const countOf = (word: string | undefined): number | undefined =>
  word === undefined ? undefined : /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word]

/** Weekdays, from `monday and thursday`, `mon, thu`, `weekdays`. */
const weekdaysOf = (words: readonly string[]): Weekday[] | undefined => {
  if (words.length === 1 && (words[0] === "weekday" || words[0] === "weekdays")) return WEEKDAYS.slice(0, 5)
  const days = words.filter((word) => word !== "and").map(weekdayFor)
  return days.length > 0 && days.every((day) => day !== undefined) ? days : undefined
}

/** A day of the month, from `the 1st`, `15th`, `the 31`. */
const monthDayOf = (words: readonly string[]): number | undefined => {
  const [day] = words.filter((word) => word !== "the")
  const match = /^(\d{1,2})(st|nd|rd|th)?$/.exec(day ?? "")
  const n = Number(match?.[1])
  return words.filter((word) => word !== "the").length === 1 && n >= 1 && n <= 31 ? n : undefined
}

/** What comes after `on`, for a unit: weekdays for weeks, a day for months. */
const onFor = (
  unit: RepeatUnit,
  words: readonly string[]
): Pick<RepeatRequest, "weekdays" | "monthDay"> | undefined => {
  if (words.length === 0) return {}
  if (unit === RepeatUnit.WEEK) {
    const weekdays = weekdaysOf(words)
    return weekdays && { weekdays }
  }
  if (unit === RepeatUnit.MONTH) {
    const monthDay = monthDayOf(words)
    return monthDay === undefined ? undefined : { monthDay }
  }
  return undefined
}

const onSchedule = (
  every: number,
  unit: RepeatUnit,
  on: Pick<RepeatRequest, "weekdays" | "monthDay"> | undefined
): RepeatRequest | undefined => on && { every, unit, from: RepeatFrom.SCHEDULE, ...on }

/** `N units after done`: counted from when it was last done. */
const afterDone = (words: readonly string[]): RepeatRequest | undefined => {
  const after = words.indexOf("after")
  if (after < 0) return undefined
  const done = words.slice(after + 1).filter((word) => !["it", "it's", "its", "is", "was", "last"].includes(word))
  if (done.length !== 1 || !["done", "finished", "completed", "completion"].includes(done[0]!)) return undefined
  const [count, unitWord, ...rest] = words.slice(0, after)
  const every = countOf(count)
  const unit = UNITS[unitWord ?? ""]
  return every !== undefined && unit && rest.length === 0 ? { every, unit, from: RepeatFrom.COMPLETION } : undefined
}

/** `every …`: a unit, a count of units, weekdays, or `weekday`. */
const every = (words: readonly string[]): RepeatRequest | undefined => {
  const on = words.indexOf("on")
  const before = on < 0 ? words : words.slice(0, on)
  const after = on < 0 ? [] : words.slice(on + 1)
  const [first, second, ...rest] = before
  const unit = UNITS[first ?? ""]
  if (unit && second === undefined) return onSchedule(1, unit, onFor(unit, after))
  const count = countOf(first)
  const counted = UNITS[second ?? ""]
  if (count !== undefined && counted && rest.length === 0) return onSchedule(count, counted, onFor(counted, after))
  const weekdays = on < 0 ? weekdaysOf(before) : undefined
  return weekdays && onSchedule(1, RepeatUnit.WEEK, { weekdays })
}

/**
 * How a task repeats, from a phrase such as `every weekday`, `every 2 weeks
 * on friday`, `monthly on the 1st` or `3 days after done`; undefined if it's
 * not one understood.
 */
export const repeatFromPhrase = (phrase: string): RepeatRequest | undefined => {
  const words = phrase
    .toLowerCase()
    .replace(/[,]/g, " ")
    .split(/\s+/)
    .filter((word) => word !== "")
  const [first, ...rest] = words
  if (first === undefined) return undefined
  if (words.includes("after")) return afterDone(words)
  if (first === "every") return every(rest)
  const adverb = ADVERBS[first]
  if (!adverb) return undefined
  const count = first === "fortnightly" ? 2 : 1
  if (rest.length === 0) return onSchedule(count, adverb, {})
  return rest[0] === "on" ? onSchedule(count, adverb, onFor(adverb, rest.slice(1))) : undefined
}
