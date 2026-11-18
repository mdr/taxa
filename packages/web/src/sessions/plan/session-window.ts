import type { IsoTime } from "@taxa/shared/dates/plain-date"
import type { Instant, Minutes } from "@taxa/shared/units"

/** How long a session has: a length from when it starts, or until a time today. */
export type SessionWindow = { type: WindowType.LENGTH; minutes: Minutes } | { type: WindowType.UNTIL; time: IsoTime }

export enum WindowType {
  LENGTH = "LENGTH",
  UNTIL = "UNTIL"
}

export const WINDOW_PRESETS: readonly Minutes[] = [30, 60, 90, 120, 180]

export const DEFAULT_WINDOW: SessionWindow = { type: WindowType.LENGTH, minutes: 60 }

/** When a session starting now ends, on the browser's clock; undefined if that time today has passed. */
export const endsAtFor = (window: SessionWindow, now: Instant): Instant | undefined => {
  if (window.type === WindowType.LENGTH) return now + window.minutes * 60_000
  const [hours = 0, minutes = 0] = window.time.split(":").map(Number)
  const end = new Date(now)
  end.setHours(hours, minutes, 0, 0)
  return end.getTime() > now ? end.getTime() : undefined
}
