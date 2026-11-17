import { describe, expect, it } from "vite-plus/test"
import { dateShortcuts } from "./date-shortcuts.ts"

describe("dateShortcuts", () => {
  it("offers today, tomorrow, Saturday and next Monday", () => {
    expect(dateShortcuts("2026-01-07").map(({ label, date }) => `${label} ${date}`)).toEqual([
      "Today 2026-01-07",
      "Tomorrow 2026-01-08",
      "This weekend 2026-01-10",
      "Next week 2026-01-12"
    ])
  })

  it("means today by this weekend on a Saturday, and a week on by next week on a Monday", () => {
    expect(dateShortcuts("2026-01-10")[2]?.date).toBe("2026-01-10")
    expect(dateShortcuts("2026-01-05")[3]?.date).toBe("2026-01-12")
  })
})
