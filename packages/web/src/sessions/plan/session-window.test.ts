import { describe, expect, it } from "vite-plus/test"
import { endsAtFor, WindowType } from "./session-window.ts"

const local = (hour: number, minute = 0): number => new Date(2026, 0, 5, hour, minute).getTime()

describe("endsAtFor", () => {
  it("ends a length of time after now", () => {
    expect(endsAtFor({ type: WindowType.LENGTH, minutes: 90 }, local(14))).toBe(local(15, 30))
  })

  it("ends at a time today, if it hasn't passed", () => {
    expect(endsAtFor({ type: WindowType.UNTIL, time: "16:30" }, local(14))).toBe(local(16, 30))
    expect(endsAtFor({ type: WindowType.UNTIL, time: "13:00" }, local(14))).toBeUndefined()
  })
})
