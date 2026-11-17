import { addDays, weekdayOf, type IsoDate } from "@taxa/shared/dates/plain-date"

export interface DateShortcut {
  label: string
  date: IsoDate
}

const SATURDAY = 5
const MONDAY = 0

/** The days people usually mean: today, tomorrow, the weekend coming, next Monday. */
export const dateShortcuts = (today: IsoDate): DateShortcut[] => [
  { label: "Today", date: today },
  { label: "Tomorrow", date: addDays(today, 1) },
  { label: "This weekend", date: addDays(today, (SATURDAY - weekdayOf(today) + 7) % 7) },
  { label: "Next week", date: addDays(today, (MONDAY - weekdayOf(today) + 7) % 7 || 7) }
]
