import { describe, expect, it } from "vite-plus/test"
import { formatDay } from "./date-format.ts"

describe("formatDay", () => {
  it("names the day, adding the year only when it isn't this year", () => {
    expect(formatDay("2026-01-09", "2026-01-07")).toBe("Fri 9 Jan")
    expect(formatDay("2027-01-08", "2026-01-07")).toBe("Fri 8 Jan 2027")
  })
})
