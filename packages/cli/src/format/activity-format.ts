import type { TimeZone } from "@taxa/shared/dates/plain-date"
import { activityText, type ActivityContext } from "@taxa/shared/activity/activity-text"
import type { Activity } from "@taxa/shared/activity/activity"

/** `2026-01-05 09:00` in the reader's time zone. */
const when = (at: string, timeZone: TimeZone): string =>
  new Date(at).toLocaleString("sv-SE", { timeZone, dateStyle: "short", timeStyle: "short" })

/** One line per change, oldest first. */
export const activityLines = (activity: Activity[], timeZone: TimeZone, context: ActivityContext): string =>
  activity.map((entry) => `${when(entry.at, timeZone)}  ${activityText(entry, context)}`).join("\n")
