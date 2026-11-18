import type { Instant, Minutes, Ms } from "@taxa/shared/units"

const MINUTE: Ms = 60_000

const hourAndMinute = (at: Instant): { hour: number; minute: number } => {
  const date = new Date(at)
  return { hour: date.getHours(), minute: date.getMinutes() }
}

/** `2:30`, on the browser's clock, 12-hour, as a time in a list of times of day. */
export const clockTime = (at: Instant): string => {
  const { hour, minute } = hourAndMinute(at)
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")}`
}

const meridiem = (at: Instant): string => (hourAndMinute(at).hour < 12 ? "am" : "pm")

/** `2:30 pm`. */
const clockTimeOfDay = (at: Instant): string => `${clockTime(at)} ${meridiem(at)}`

/** `2:00 – 4:00 pm`, or `11:00 am – 1:00 pm` across noon. */
export const timeSpan = (from: Instant, to: Instant): string =>
  meridiem(from) === meridiem(to)
    ? `${clockTime(from)} – ${clockTimeOfDay(to)}`
    : `${clockTimeOfDay(from)} – ${clockTimeOfDay(to)}`

/** `45 min`, `2 h`, `1 h 50 min`. */
export const minutesText = (minutes: Minutes): string => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** A length of time to the nearest minute, as `minutesText` writes it. */
export const durationText = (time: Ms): string => minutesText(Math.round(Math.abs(time) / MINUTE))

/** `25:04`: minutes and seconds, for a countdown. */
export const countdown = (time: Ms): string => {
  const seconds = Math.max(0, Math.ceil(time / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** `25m` left, or `+15m` over: short enough for the sidebar. */
export const shortLeft = (left: Ms): string => {
  const minutes = Math.ceil(Math.abs(left) / MINUTE)
  return left >= 0 ? `${minutes}m` : `+${Math.floor(Math.abs(left) / MINUTE)}m`
}
