import { describe, expect, it } from "vite-plus/test"
import { suggestPrefix } from "./prefix-suggestion.ts"

describe("suggestPrefix", () => {
  it("takes the first letter", () => {
    expect(suggestPrefix("home", new Set())).toBe("H")
  })

  it("adds a later letter when the first is taken", () => {
    expect(suggestPrefix("Hobbies", new Set(["H"]))).toBe("HO")
    expect(suggestPrefix("Hobbies", new Set(["H", "HO"]))).toBe("HB")
  })

  it("ignores anything that isn't a letter", () => {
    expect(suggestPrefix("3D printing", new Set())).toBe("D")
  })

  it("is empty when nothing fits", () => {
    expect(suggestPrefix("  ", new Set())).toBe("")
    expect(suggestPrefix("A", new Set(["A"]))).toBe("")
  })
})
