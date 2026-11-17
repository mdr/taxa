import { timeZone } from "@taxa/shared/dates/plain-date"
import { describe, expect, it } from "vite-plus/test"
import { relativeTime } from "./relative-time.ts"

const NOW = Date.UTC(2026, 0, 7, 15, 0)
const MINUTE = 60_000

describe("relativeTime", () => {
  it.each([
    [NOW - 20_000, "just now"],
    [NOW - 5 * MINUTE, "5 min ago"],
    [Date.UTC(2026, 0, 7, 9, 5), "09:05"],
    [Date.UTC(2026, 0, 6, 14, 5), "Yesterday 14:05"],
    [Date.UTC(2026, 0, 2, 14, 5), "Fri 2 Jan"]
  ])("says %i as %s", (at, text) => {
    expect(relativeTime(at, NOW, timeZone("Europe/London"))).toBe(text)
  })

  it("works out days in the reader's time zone", () => {
    expect(relativeTime(Date.UTC(2026, 0, 6, 23, 30), Date.UTC(2026, 0, 7, 1, 0), timeZone("Asia/Tokyo"))).toBe("08:30")
  })
})
