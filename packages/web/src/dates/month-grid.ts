import { addDays, weekdayOf, type IsoDate } from "@taxa/shared/dates/plain-date"

/** A calendar month: its first day, and the weeks shown for it, Monday first, padded with the days around it. */
export interface MonthGrid {
  first: IsoDate
  weeks: IsoDate[][]
}

const pad = (value: number): string => String(value).padStart(2, "0")

/** The first of the month `date` is in, moved by `months`. */
export const firstOfMonth = (date: IsoDate, months = 0): IsoDate => {
  const [year, month] = date.split("-").map(Number)
  const index = year! * 12 + (month! - 1) + months
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}-01`
}

export const monthGrid = (date: IsoDate): MonthGrid => {
  const first = firstOfMonth(date)
  const next = firstOfMonth(date, 1)
  const weeks: IsoDate[][] = []
  for (let day = addDays(first, -weekdayOf(first)); day < next; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, offset) => addDays(day, offset)))
  }
  return { first, weeks }
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
]

/** `January 2026`. */
export const monthName = (first: IsoDate): string => {
  const [year, month] = first.split("-").map(Number)
  return `${MONTHS[month! - 1]} ${year}`
}
