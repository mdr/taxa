import { addDays, isIsoDate, weekdayOf, type IsoDate } from "./plain-date.ts"

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const RELATIVE = /^\+(\d+)([dw])$/

const RELATIVE_DAYS: Record<string, number> = { today: 0, tomorrow: 1, yesterday: -1 }

const weekdayNamed = (word: string): number | undefined => {
  const index = WEEKDAYS.findIndex((day) => word.length >= 3 && day.startsWith(word))
  return index === -1 ? undefined : index
}

/**
 * A date as people and agents type it: `2026-03-01`, `today`, `tomorrow`,
 * `yesterday`, a weekday (`fri`, `friday`: the coming one, today if it is
 * that day), or `+3d` / `+2w`. Undefined if it isn't one of those.
 */
export const parseDateInput = (text: string, today: IsoDate): IsoDate | undefined => {
  const word = text.trim().toLowerCase()
  if (isIsoDate(word)) return word
  const relativeDays = RELATIVE_DAYS[word]
  if (relativeDays !== undefined) return addDays(today, relativeDays)
  const relative = RELATIVE.exec(word)
  if (relative) return addDays(today, Number(relative[1]) * (relative[2] === "w" ? 7 : 1))
  const weekday = weekdayNamed(word)
  if (weekday === undefined) return undefined
  return addDays(today, (weekday - weekdayOf(today) + 7) % 7)
}

export const DATE_INPUT_HELP = "YYYY-MM-DD, today, tomorrow, yesterday, a weekday (fri), +3d or +2w"
