import type { TimeZone } from "@taxa/shared/dates/plain-date"
import { activityText, type ActivityContext } from "@taxa/shared/activity/activity-text"
import type { Activity } from "@taxa/shared/activity/activity"
import { localTime } from "./local-time.ts"

/** One line per change, oldest first, numbered by the version it brought the task to: what `taxa undo` takes. */
export const activityLines = (activity: Activity[], timeZone: TimeZone, context: ActivityContext): string => {
  const width = String(activity.at(-1)?.version ?? 1).length
  return activity
    .map(
      (entry) =>
        `${String(entry.version).padStart(width)}  ${localTime(entry.at, timeZone)}  ${activityText(entry, context)}`
    )
    .join("\n")
}
