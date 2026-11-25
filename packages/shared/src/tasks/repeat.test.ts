import { describe, expect, it } from "vite-plus/test"
import {
  firstOccurrence,
  nextOccurrence,
  OccurrenceOutcome,
  ordinal,
  RepeatFrom,
  repeatOf,
  repeatText,
  RepeatUnit,
  Weekday,
  type Repeat,
  type RepeatRequest
} from "./repeat.ts"

const DONE = OccurrenceOutcome.DONE
const SKIPPED = OccurrenceOutcome.SKIPPED

const schedule = (request: Omit<RepeatRequest, "from">, starts = "2026-11-02"): Repeat =>
  repeatOf({ ...request, from: RepeatFrom.SCHEDULE }, starts)

describe("repeatOf", () => {
  it("fills in the start date's weekday or day of the month, and the start", () => {
    // 2026-11-02 is a Monday.
    expect(schedule({ every: 1, unit: RepeatUnit.WEEK })).toEqual({
      every: 1,
      unit: RepeatUnit.WEEK,
      from: RepeatFrom.SCHEDULE,
      weekdays: [Weekday.MONDAY],
      starts: "2026-11-02"
    })
    expect(schedule({ every: 1, unit: RepeatUnit.MONTH }, "2026-01-31")).toMatchObject({ monthDay: 31 })
  })

  it("puts weekdays in order, once each, so it compares the same however it was asked for", () => {
    const repeat = schedule({
      every: 1,
      unit: RepeatUnit.WEEK,
      weekdays: [Weekday.THURSDAY, Weekday.MONDAY, Weekday.THURSDAY]
    })
    expect(repeat.weekdays).toEqual([Weekday.MONDAY, Weekday.THURSDAY])
    expect(JSON.stringify(repeat)).toBe(
      JSON.stringify(schedule({ every: 1, unit: RepeatUnit.WEEK, weekdays: [Weekday.MONDAY, Weekday.THURSDAY] }))
    )
  })
})

describe("nextOccurrence", () => {
  it("is the next day for a daily task, done on the day", () => {
    const daily = schedule({ every: 1, unit: RepeatUnit.DAY })
    expect(nextOccurrence(daily, { scheduled: "2026-11-25", today: "2026-11-25", outcome: DONE })).toBe("2026-11-26")
  })

  it("is the first after today for one done late, and after its date for one done early", () => {
    const mondays = schedule({ every: 1, unit: RepeatUnit.WEEK })
    // Monday the 23rd's, done on Wednesday the 25th: next Monday.
    expect(nextOccurrence(mondays, { scheduled: "2026-11-23", today: "2026-11-25", outcome: DONE })).toBe("2026-11-30")
    const daily = schedule({ every: 1, unit: RepeatUnit.DAY })
    // Thursday's, done on Wednesday: Friday.
    expect(nextOccurrence(daily, { scheduled: "2026-11-26", today: "2026-11-25", outcome: DONE })).toBe("2026-11-27")
  })

  it("keeps to its days of the week, and every other week counts from the week it starts", () => {
    const monThu = schedule({ every: 1, unit: RepeatUnit.WEEK, weekdays: [Weekday.MONDAY, Weekday.THURSDAY] })
    expect(nextOccurrence(monThu, { scheduled: "2026-11-23", today: "2026-11-23", outcome: DONE })).toBe("2026-11-26")
    expect(nextOccurrence(monThu, { scheduled: "2026-11-26", today: "2026-11-26", outcome: DONE })).toBe("2026-11-30")
    const fortnightly = schedule({ every: 2, unit: RepeatUnit.WEEK, weekdays: [Weekday.FRIDAY] })
    // Starting the week of Monday 2 Nov: Friday 6th, 20th, 4 Dec.
    expect(nextOccurrence(fortnightly, { scheduled: "2026-11-06", today: "2026-11-06", outcome: DONE })).toBe(
      "2026-11-20"
    )
    // Moved to Saturday the 7th and done then, it's still the 20th: the series doesn't shift.
    expect(nextOccurrence(fortnightly, { scheduled: "2026-11-07", today: "2026-11-07", outcome: DONE })).toBe(
      "2026-11-20"
    )
  })

  it("falls on the last day of shorter months, and 29 February on the 28th", () => {
    const monthly = schedule({ every: 1, unit: RepeatUnit.MONTH }, "2026-01-31")
    expect(nextOccurrence(monthly, { scheduled: "2026-01-31", today: "2026-01-31", outcome: DONE })).toBe("2026-02-28")
    expect(nextOccurrence(monthly, { scheduled: "2026-02-28", today: "2026-02-28", outcome: DONE })).toBe("2026-03-31")
    const yearly = schedule({ every: 1, unit: RepeatUnit.YEAR }, "2028-02-29")
    expect(nextOccurrence(yearly, { scheduled: "2028-02-29", today: "2028-02-29", outcome: DONE })).toBe("2029-02-28")
    const quarterly = schedule({ every: 3, unit: RepeatUnit.MONTH, monthDay: 15 }, "2026-01-15")
    expect(nextOccurrence(quarterly, { scheduled: "2026-01-15", today: "2026-02-01", outcome: DONE })).toBe(
      "2026-04-15"
    )
  })

  it("counts from when it was done, or from its date if skipped early", () => {
    const afterDone = repeatOf({ every: 3, unit: RepeatUnit.DAY, from: RepeatFrom.COMPLETION }, "2026-11-01")
    expect(nextOccurrence(afterDone, { scheduled: "2026-11-20", today: "2026-11-25", outcome: DONE })).toBe(
      "2026-11-28"
    )
    expect(nextOccurrence(afterDone, { scheduled: "2026-11-27", today: "2026-11-25", outcome: SKIPPED })).toBe(
      "2026-11-30"
    )
    const monthAfter = repeatOf({ every: 1, unit: RepeatUnit.MONTH, from: RepeatFrom.COMPLETION }, "2026-01-01")
    expect(nextOccurrence(monthAfter, { scheduled: "2026-01-31", today: "2026-01-31", outcome: DONE })).toBe(
      "2026-02-28"
    )
  })
})

describe("firstOccurrence", () => {
  it("is the first day it comes round, from a day on", () => {
    const monThu = schedule({ every: 1, unit: RepeatUnit.WEEK, weekdays: [Weekday.MONDAY, Weekday.THURSDAY] })
    expect(firstOccurrence(monThu, "2026-11-24")).toBe("2026-11-26")
    expect(firstOccurrence(monThu, "2026-11-26")).toBe("2026-11-26")
    expect(
      firstOccurrence(
        repeatOf({ every: 2, unit: RepeatUnit.DAY, from: RepeatFrom.COMPLETION }, "2026-11-01"),
        "2026-11-24"
      )
    ).toBe("2026-11-24")
  })
})

describe("repeatText", () => {
  it("says how it repeats, in a few words", () => {
    const week = (weekdays: Weekday[], every = 1): Repeat => schedule({ every, unit: RepeatUnit.WEEK, weekdays })
    expect(repeatText(schedule({ every: 1, unit: RepeatUnit.DAY }))).toBe("Every day")
    expect(repeatText(schedule({ every: 2, unit: RepeatUnit.DAY }))).toBe("Every 2 days")
    expect(
      repeatText(week([Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY]))
    ).toBe("Every weekday")
    expect(repeatText(week([Weekday.MONDAY, Weekday.THURSDAY]))).toBe("Every Monday and Thursday")
    expect(repeatText(week([Weekday.FRIDAY], 2))).toBe("Every 2 weeks on Friday")
    expect(repeatText(schedule({ every: 1, unit: RepeatUnit.MONTH, monthDay: 1 }))).toBe("Monthly on the 1st")
    expect(repeatText(schedule({ every: 1, unit: RepeatUnit.YEAR }, "2026-11-25"))).toBe("Every year on 25 Nov")
    expect(repeatText(repeatOf({ every: 3, unit: RepeatUnit.DAY, from: RepeatFrom.COMPLETION }, "2026-11-25"))).toBe(
      "3 days after it's done"
    )
    expect(repeatText(repeatOf({ every: 1, unit: RepeatUnit.WEEK, from: RepeatFrom.COMPLETION }, "2026-11-25"))).toBe(
      "A week after it's done"
    )
  })

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 31].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "31st"
    ])
  })
})
