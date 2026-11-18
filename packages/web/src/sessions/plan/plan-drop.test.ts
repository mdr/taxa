import { taskId } from "@taxa/shared/ids"
import { describe, expect, it } from "vite-plus/test"
import { dropOf, DropType, gapAt, PLAN_END, PLAN_GAP, suggestionDragId, SUGGESTIONS } from "./plan-drop.ts"

const tap = taskId("0190a1b2-0000-7000-8000-000000000001")
const radiators = taskId("0190a1b2-0000-7000-8000-000000000002")
const passport = taskId("0190a1b2-0000-7000-8000-000000000003")
const movable = [tap, radiators]

describe("gapAt", () => {
  const middles = [100, 150]

  it("opens after every task the pointer's below the middle of, wherever on the plan's side it is", () => {
    expect(gapAt({ over: tap, y: 90, middles, movable, open: undefined })).toBe(0)
    expect(gapAt({ over: PLAN_GAP, y: 120, middles, movable, open: 0 })).toBe(1)
    expect(gapAt({ over: radiators, y: 160, middles, movable, open: 1 })).toBe(2)
    expect(gapAt({ over: PLAN_END, y: 900, middles, movable, open: 1 })).toBe(2)
  })

  it("with the keyboard, opens before the task it's over, stays over itself, and is last elsewhere", () => {
    expect(gapAt({ over: radiators, y: undefined, middles, movable, open: undefined })).toBe(1)
    expect(gapAt({ over: PLAN_GAP, y: undefined, middles, movable, open: 0 })).toBe(0)
    expect(gapAt({ over: PLAN_END, y: undefined, middles, movable, open: 0 })).toBe(2)
  })

  it("closes off the plan", () => {
    expect(gapAt({ over: undefined, y: 120, middles, movable, open: 1 })).toBeUndefined()
    expect(gapAt({ over: SUGGESTIONS, y: 120, middles, movable, open: 1 })).toBeUndefined()
  })
})

describe("dropOf", () => {
  it("puts a suggestion where the gap is open, last at the end, and nowhere with none", () => {
    const dragged = suggestionDragId(passport)
    expect(dropOf({ dragged, over: PLAN_GAP, gap: 1, movable })).toEqual({
      type: DropType.ADD,
      taskId: passport,
      at: 1
    })
    expect(dropOf({ dragged, over: PLAN_END, gap: 2, movable })).toEqual({
      type: DropType.ADD,
      taskId: passport,
      at: undefined
    })
    expect(dropOf({ dragged, over: undefined, gap: undefined, movable })).toBeUndefined()
  })

  it("moves a planned task to another's place, or takes it out on the suggestions", () => {
    expect(dropOf({ dragged: radiators, over: tap, gap: undefined, movable })).toEqual({
      type: DropType.MOVE,
      taskId: radiators,
      to: 0
    })
    expect(dropOf({ dragged: radiators, over: SUGGESTIONS, gap: undefined, movable })).toEqual({
      type: DropType.REMOVE,
      taskId: radiators
    })
  })

  it("does nothing with a planned task let go elsewhere or on itself", () => {
    expect(dropOf({ dragged: radiators, over: radiators, gap: undefined, movable })).toBeUndefined()
    expect(dropOf({ dragged: radiators, over: undefined, gap: undefined, movable })).toBeUndefined()
  })
})
