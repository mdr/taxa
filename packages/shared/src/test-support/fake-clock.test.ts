import { describe, expect, it } from "vite-plus/test"
import { FakeClock } from "./fake-clock.ts"

describe("FakeClock", () => {
  it("stands still until advanced", () => {
    const clock = new FakeClock(1_000)
    expect(clock.now()).toBe(1_000)
    clock.advance(500)
    expect(clock.now()).toBe(1_500)
  })

  it("fires timers in order once advanced past them, and not cleared ones", () => {
    const clock = new FakeClock(0)
    const fired: string[] = []
    clock.setTimeout(() => fired.push("late"), 200)
    clock.setTimeout(() => fired.push("early"), 100)
    const cleared = clock.setTimeout(() => fired.push("cleared"), 150)
    clock.clearTimeout(cleared)

    clock.advance(99)
    expect(fired).toEqual([])
    clock.advance(200)
    expect(fired).toEqual(["early", "late"])
  })
})
