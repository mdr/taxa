import { describe, expect, it } from "vite-plus/test"
import { trackProblem } from "./tracked-controls.ts"

describe("trackProblem", () => {
  it("wants data-track on buttons, fields and dialogs", () => {
    expect(trackProblem("button", ["type", "onClick"])).toContain("data-track")
    expect(trackProblem("dialog", [])).toContain("data-track")
    expect(trackProblem("input", ["data-track", "value"])).toBeUndefined()
  })

  it("leaves other elements alone", () => {
    expect(trackProblem("div", ["onClick"])).toBeUndefined()
    expect(trackProblem("Popover", [])).toBeUndefined()
  })
})
