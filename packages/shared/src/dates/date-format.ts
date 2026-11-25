import { addDays, weekdayOf, type IsoDate } from "./plain-date.ts"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** `Fri 9 Jan`, with the year when it isn't this year's: `Fri 8 Jan 2027`. */
export const formatDay = (date: IsoDate, today: IsoDate): string => {
  const [year, month, day] = date.split("-").map(Number)
  const shown = `${WEEKDAYS[weekdayOf(date)]} ${day} ${MONTHS[month! - 1]}`
  return date.slice(0, 4) === today.slice(0, 4) ? shown : `${shown} ${year}`
}

/** `today`, `tomorrow`, or else as `formatDay` says it. */
export const formatNearDay = (date: IsoDate, today: IsoDate): string => {
  if (date === today) return "today"
  return date === addDays(today, 1) ? "tomorrow" : formatDay(date, today)
}
