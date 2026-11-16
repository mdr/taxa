import { describe, expect, it } from "vite-plus/test"
import { formatEstimate, parseEstimate } from "./estimate.ts"

describe("estimates", () => {
  it.each([
    ["30", 30],
    ["30m", 30],
    ["1h", 60],
    ["1.5h", 90],
    ["1h30m", 90],
    ["2H", 120]
  ])("read %s as %i minutes", (text, minutes) => {
    expect(parseEstimate(text)).toBe(minutes)
  })

  it.each(["", "h", "0", "soon", "1d", "-5"])("reject %j", (text) => {
    expect(parseEstimate(text)).toBeUndefined()
  })

  it("are written in hours and minutes", () => {
    expect([45, 60, 90, 125].map(formatEstimate)).toEqual(["45m", "1h", "1h30m", "2h5m"])
  })
})
