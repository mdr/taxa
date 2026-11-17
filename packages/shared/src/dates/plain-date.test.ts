import { describe, expect, it } from "vite-plus/test"
import { addDays, dateIn, isIsoDate, isIsoTime, isTimeZone, timeZone, weekdayOf } from "./plain-date.ts"

describe("plain dates", () => {
  it("accept only real dates written YYYY-MM-DD", () => {
    expect(isIsoDate("2026-01-05")).toBe(true)
    expect(isIsoDate("2024-02-29")).toBe(true)
    expect(isIsoDate("2026-02-29")).toBe(false)
    expect(isIsoDate("2026-1-5")).toBe(false)
  })

  it("accept times written HH:MM", () => {
    expect(isIsoTime("09:30")).toBe(true)
    expect(isIsoTime("23:59")).toBe(true)
    expect(isIsoTime("24:00")).toBe(false)
    expect(isIsoTime("9:30")).toBe(false)
  })

  it("add days across months, years and the clocks changing", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30")
    expect(addDays("2026-01-05", -5)).toBe("2025-12-31")
  })

  it("know the day of the week, Monday first", () => {
    expect(weekdayOf("2026-01-05")).toBe(0)
    expect(weekdayOf("2026-01-11")).toBe(6)
  })

  it("know what date it is in a time zone", () => {
    const lateMondayInLondon = Date.UTC(2026, 0, 5, 23, 30)
    expect(dateIn(timeZone("Europe/London"), lateMondayInLondon)).toBe("2026-01-05")
    expect(dateIn(timeZone("Asia/Tokyo"), lateMondayInLondon)).toBe("2026-01-06")
    expect(dateIn(timeZone("America/New_York"), lateMondayInLondon)).toBe("2026-01-05")
  })

  it("know real time zone names", () => {
    expect(isTimeZone("Europe/London")).toBe(true)
    expect(isTimeZone("Mars/Olympus")).toBe(false)
  })
})
