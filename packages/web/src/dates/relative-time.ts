import { formatDay } from "@taxa/shared/dates/date-format"
import { addDays, dateIn, type TimeZone } from "@taxa/shared/dates/plain-date"
import type { Instant } from "@taxa/shared/units"

const MINUTE = 60_000

const clockTime = (at: Instant, timeZone: TimeZone): string =>
  new Date(at).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" })

/** `just now`, `5 min ago`, `14:05`, `Yesterday 14:05`, `Fri 9 Jan`. */
export const relativeTime = (at: Instant, now: Instant, timeZone: TimeZone): string => {
  const ago = now - at
  if (ago < MINUTE) return "just now"
  if (ago < 60 * MINUTE) return `${Math.floor(ago / MINUTE)} min ago`
  const day = dateIn(timeZone, at)
  const today = dateIn(timeZone, now)
  if (day === today) return clockTime(at, timeZone)
  if (day === addDays(today, -1)) return `Yesterday ${clockTime(at, timeZone)}`
  return formatDay(day, today)
}
