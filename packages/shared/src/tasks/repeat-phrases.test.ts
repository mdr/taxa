import { describe, expect, it } from "vite-plus/test"
import { RepeatFrom, RepeatUnit, Weekday } from "./repeat.ts"
import { REPEAT_EXAMPLES, repeatFromPhrase } from "./repeat-phrases.ts"

const SCHEDULE = RepeatFrom.SCHEDULE

describe("repeatFromPhrase", () => {
  it("understands how often", () => {
    expect(repeatFromPhrase("daily")).toEqual({ every: 1, unit: RepeatUnit.DAY, from: SCHEDULE })
    expect(repeatFromPhrase("Every day")).toEqual({ every: 1, unit: RepeatUnit.DAY, from: SCHEDULE })
    expect(repeatFromPhrase("every 2 days")).toEqual({ every: 2, unit: RepeatUnit.DAY, from: SCHEDULE })
    expect(repeatFromPhrase("every three weeks")).toEqual({ every: 3, unit: RepeatUnit.WEEK, from: SCHEDULE })
    expect(repeatFromPhrase("fortnightly")).toEqual({ every: 2, unit: RepeatUnit.WEEK, from: SCHEDULE })
    expect(repeatFromPhrase("yearly")).toEqual({ every: 1, unit: RepeatUnit.YEAR, from: SCHEDULE })
  })

  it("understands days of the week and of the month", () => {
    expect(repeatFromPhrase("every weekday")?.weekdays).toEqual([
      Weekday.MONDAY,
      Weekday.TUESDAY,
      Weekday.WEDNESDAY,
      Weekday.THURSDAY,
      Weekday.FRIDAY
    ])
    expect(repeatFromPhrase("every monday and thursday")).toEqual({
      every: 1,
      unit: RepeatUnit.WEEK,
      from: SCHEDULE,
      weekdays: [Weekday.MONDAY, Weekday.THURSDAY]
    })
    expect(repeatFromPhrase("every 2 weeks on fri")?.weekdays).toEqual([Weekday.FRIDAY])
    expect(repeatFromPhrase("weekly on mon, wed")?.weekdays).toEqual([Weekday.MONDAY, Weekday.WEDNESDAY])
    expect(repeatFromPhrase("every tuesdays")?.weekdays).toEqual([Weekday.TUESDAY])
    expect(repeatFromPhrase("monthly on the 1st")).toEqual({
      every: 1,
      unit: RepeatUnit.MONTH,
      from: SCHEDULE,
      monthDay: 1
    })
    expect(repeatFromPhrase("every 3 months on the 15th")).toMatchObject({ every: 3, monthDay: 15 })
  })

  it("understands counting from when it's done", () => {
    expect(repeatFromPhrase("3 days after done")).toEqual({
      every: 3,
      unit: RepeatUnit.DAY,
      from: RepeatFrom.COMPLETION
    })
    expect(repeatFromPhrase("a week after it's done")).toEqual({
      every: 1,
      unit: RepeatUnit.WEEK,
      from: RepeatFrom.COMPLETION
    })
  })

  it("won't guess at anything else", () => {
    for (const phrase of [
      "",
      "sometimes",
      "every",
      "every 2",
      "monthly on friday",
      "weekly on the 3rd",
      "every day on monday",
      "3 days after lunch",
      "every 2 blursdays"
    ])
      expect(repeatFromPhrase(phrase), phrase).toBeUndefined()
  })

  it("understands each of its own examples", () => {
    for (const phrase of REPEAT_EXAMPLES) expect(repeatFromPhrase(phrase), phrase).toBeDefined()
  })
})
