import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Occurrence } from "@taxa/shared/tasks/occurrence"
import { OccurrenceOutcome } from "@taxa/shared/tasks/repeat"

/** How many of a repeating task's latest occurrences `taxa show` lists. */
const SHOWN = 7

const OUTCOME_TEXT: Record<OccurrenceOutcome, string> = {
  [OccurrenceOutcome.DONE]: "done",
  [OccurrenceOutcome.SKIPPED]: "skipped",
  [OccurrenceOutcome.MISSED]: "missed"
}

/** A repeating task's latest occurrences, to follow its details: nothing for one with none. */
export const recentOccurrences = (occurrences: readonly Occurrence[], today: IsoDate): string => {
  if (occurrences.length === 0) return ""
  const lines = occurrences.slice(0, SHOWN).map(({ date, outcome, on }) => {
    const late = on !== date ? ` (on ${formatDay(on, today)})` : ""
    return `  ${formatDay(date, today)}  ${OUTCOME_TEXT[outcome]}${late}`
  })
  return `\n\nLately\n${lines.join("\n")}`
}
