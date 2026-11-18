import { taskId } from "@taxa/shared/ids"
import { describe, expect, it } from "vite-plus/test"
import { dropOf, DropType, PLAN_END, suggestionDragId, SUGGESTIONS } from "./plan-drop.ts"

const tap = taskId("0190a1b2-0000-7000-8000-000000000001")
const radiators = taskId("0190a1b2-0000-7000-8000-000000000002")
const passport = taskId("0190a1b2-0000-7000-8000-000000000003")
const movable = [tap, radiators]

describe("dropOf", () => {
  it("puts a suggestion before or after a task by which half it's let go on, and last anywhere else on the plan", () => {
    const dragged = suggestionDragId(passport)
    expect(dropOf({ dragged, over: radiators, lowerHalf: false, movable })).toEqual({
      type: DropType.ADD,
      taskId: passport,
      at: 1
    })
    expect(dropOf({ dragged, over: radiators, lowerHalf: true, movable })).toEqual({
      type: DropType.ADD,
      taskId: passport,
      at: 2
    })
    expect(dropOf({ dragged, over: PLAN_END, lowerHalf: false, movable })).toEqual({
      type: DropType.ADD,
      taskId: passport,
      at: undefined
    })
  })

  it("moves a planned task to another's place, or takes it out on the suggestions", () => {
    expect(dropOf({ dragged: radiators, over: tap, lowerHalf: false, movable })).toEqual({
      type: DropType.MOVE,
      taskId: radiators,
      to: 0
    })
    expect(dropOf({ dragged: radiators, over: SUGGESTIONS, lowerHalf: false, movable })).toEqual({
      type: DropType.REMOVE,
      taskId: radiators
    })
  })

  it("does nothing let go elsewhere, on itself, or a suggestion back on the suggestions", () => {
    expect(dropOf({ dragged: suggestionDragId(passport), over: undefined, lowerHalf: false, movable })).toBeUndefined()
    expect(
      dropOf({ dragged: suggestionDragId(passport), over: SUGGESTIONS, lowerHalf: false, movable })
    ).toBeUndefined()
    expect(dropOf({ dragged: radiators, over: radiators, lowerHalf: false, movable })).toBeUndefined()
    expect(dropOf({ dragged: radiators, over: undefined, lowerHalf: false, movable })).toBeUndefined()
  })
})
