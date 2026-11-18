import { describe, expect, it } from "vite-plus/test"
import { clockTime, countdown, durationText, minutesText, shortLeft, timeSpan } from "./session-text.ts"

const local = (hour: number, minute = 0): number => new Date(2026, 0, 5, hour, minute).getTime()

describe("session text", () => {
  it("writes times of day on a 12-hour clock, with am or pm where it's needed", () => {
    expect(clockTime(local(14, 5))).toBe("2:05")
    expect(clockTime(local(0, 30))).toBe("12:30")
    expect(timeSpan(local(14), local(16))).toBe("2:00 – 4:00 pm")
    expect(timeSpan(local(11), local(13))).toBe("11:00 am – 1:00 pm")
  })

  it("writes lengths of time in hours and minutes", () => {
    expect(minutesText(45)).toBe("45 min")
    expect(minutesText(120)).toBe("2 h")
    expect(minutesText(110)).toBe("1 h 50 min")
    expect(durationText(-15 * 60_000)).toBe("15 min")
  })

  it("counts down in minutes and seconds, and says briefly what's left or over", () => {
    expect(countdown(25 * 60_000 + 4_000)).toBe("25:04")
    expect(countdown(-5_000)).toBe("0:00")
    expect(shortLeft(24 * 60_000 + 1)).toBe("25m")
    expect(shortLeft(-15 * 60_000 - 30_000)).toBe("+15m")
  })
})
