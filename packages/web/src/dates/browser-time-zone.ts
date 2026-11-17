import { timeZone, type TimeZone } from "@taxa/shared/dates/plain-date"

/** The time zone the browser is in. */
export const browserTimeZone = (): TimeZone => timeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
