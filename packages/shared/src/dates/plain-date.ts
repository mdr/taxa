import { z } from "zod"
import { flavoured, type Flavour, type Instant } from "../units.ts"

/** A calendar date with no time zone, as YYYY-MM-DD: Friday is Friday wherever you are. */
export type IsoDate = Flavour<string, "IsoDate">

/** A wall-clock time with no time zone, as HH:MM. */
export type IsoTime = Flavour<string, "IsoTime">

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY_MS = 86_400_000

const utcMidnight = (date: IsoDate): number => {
  const [, year, month, day] = ISO_DATE.exec(date) ?? []
  return Date.UTC(Number(year), Number(month) - 1, Number(day))
}

const fromUtcMidnight = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10)

/** Whether the text is a real date written YYYY-MM-DD (not 2026-02-30). */
export const isIsoDate = (text: string): boolean => ISO_DATE.test(text) && fromUtcMidnight(utcMidnight(text)) === text

export const isIsoTime = (text: string): boolean => ISO_TIME.test(text)

/** How many days on `to` is from `from`. */
export const daysBetween = (from: IsoDate, to: IsoDate): number =>
  Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS)

export const addDays = (date: IsoDate, days: number): IsoDate => fromUtcMidnight(utcMidnight(date) + days * DAY_MS)

/** 0 for Monday through 6 for Sunday. */
export const weekdayOf = (date: IsoDate): number => (new Date(utcMidnight(date)).getUTCDay() + 6) % 7

/** The date it is at `at` in `timeZone` (an IANA name such as Europe/London). */
export const dateIn = (timeZone: TimeZone, at: Instant): IsoDate =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at)

export const isTimeZone = (name: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: name })
    return true
  } catch {
    return false
  }
}

export const IsoDateSchema = flavoured<IsoDate>(z.string().refine(isIsoDate, "a date written YYYY-MM-DD"))

export const IsoTimeSchema = flavoured<IsoTime>(z.string().refine(isIsoTime, "a time written HH:MM"))

/** An IANA time zone name, such as Europe/London. */
export const TimeZoneSchema = z
  .string()
  .refine(isTimeZone, "an IANA time zone, such as Europe/London")
  .brand<"TimeZone">()
export type TimeZone = z.infer<typeof TimeZoneSchema>
export const timeZone = (name: string): TimeZone => TimeZoneSchema.parse(name)
