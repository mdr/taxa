import { describe, expect, it } from "vite-plus/test"
import { firstOfMonth, monthGrid, monthName } from "./month-grid.ts"

describe("monthGrid", () => {
  it("lays a month out in weeks from Monday, with the days around it", () => {
    const { first, weeks } = monthGrid("2026-01-15")
    expect(first).toBe("2026-01-01")
    expect(weeks).toHaveLength(5)
    expect(weeks[0]).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04"
    ])
    expect(weeks.at(-1)?.at(-1)).toBe("2026-02-01")
  })

  it("moves between months across years", () => {
    expect(firstOfMonth("2026-01-15", -1)).toBe("2025-12-01")
    expect(firstOfMonth("2025-12-31", 1)).toBe("2026-01-01")
  })

  it("names the month", () => {
    expect(monthName("2026-01-01")).toBe("January 2026")
  })
})
