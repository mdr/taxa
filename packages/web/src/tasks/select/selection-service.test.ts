import { describe, expect, it } from "vite-plus/test"
import type { TaskId } from "@taxa/shared/ids"
import { SelectionService } from "./selection-service.ts"

const ids = ["a", "b", "c", "d", "e"] as TaskId[]

describe("SelectionService", () => {
  it("chooses tasks one at a time, starting to select with the first", () => {
    const selection = new SelectionService(() => ids)
    selection.toggle(ids[2]!)
    selection.toggle(ids[0]!)
    expect(selection.state.selecting).toBe(true)
    // As listed, not as chosen.
    expect(selection.chosen()).toEqual(["a", "c"])
    selection.toggle(ids[2]!)
    expect(selection.chosen()).toEqual(["a"])
  })

  it("chooses the run from the last one chosen, either way, keeping what's chosen already", () => {
    const selection = new SelectionService(() => ids)
    selection.toggle(ids[0]!)
    selection.toggle(ids[3]!)
    selection.extend(ids[1]!)
    expect(selection.chosen()).toEqual(["a", "b", "c", "d"])
  })

  it("chooses all, then none; and lets go of everything on stopping", () => {
    const selection = new SelectionService(() => ids)
    selection.toggleAll()
    expect(selection.chosen()).toEqual(ids)
    selection.toggleAll()
    expect(selection.chosen()).toEqual([])
    selection.toggle(ids[1]!)
    selection.stop()
    expect(selection.state).toEqual({ selecting: false, selected: [], anchor: undefined })
  })

  it("counts only those still listed", () => {
    let listed = ids
    const selection = new SelectionService(() => listed)
    selection.toggleAll()
    listed = ids.slice(0, 2)
    expect(selection.chosen()).toEqual(["a", "b"])
  })
})
