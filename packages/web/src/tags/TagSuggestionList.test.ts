import { describe, expect, it } from "vite-plus/test"
import { movedHighlight, NONE_HIGHLIGHTED, startingHighlight } from "./TagSuggestionList.tsx"

describe("the highlighted tag suggestion", () => {
  it("starts on the best match once something's typed, and nowhere before", () => {
    expect(startingHighlight("")).toBe(NONE_HIGHLIGHTED)
    expect(startingHighlight("li")).toBe(0)
  })

  it("goes from nowhere to the first with Down, or the last with Up, then round", () => {
    expect(movedHighlight("ArrowDown", NONE_HIGHLIGHTED, 3)).toBe(0)
    expect(movedHighlight("ArrowUp", NONE_HIGHLIGHTED, 3)).toBe(2)
    expect(movedHighlight("ArrowDown", 2, 3)).toBe(0)
    expect(movedHighlight("Enter", 0, 3)).toBeUndefined()
  })
})
