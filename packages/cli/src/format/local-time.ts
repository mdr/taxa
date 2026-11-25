import type { TimeZone } from "@taxa/shared/dates/plain-date"

/** `2026-01-05 09:00` in the reader's time zone. */
export const localTime = (at: string, timeZone: TimeZone): string =>
  new Date(at).toLocaleString("sv-SE", { timeZone, dateStyle: "short", timeStyle: "short" })
