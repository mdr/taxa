import { describe, expect, it } from "vite-plus/test"
import { SuggestionType, tagSuggestions } from "./tag-suggestions.ts"

const all = [
  { name: "admin", openCount: 1 },
  { name: "car", openCount: 4 },
  { name: "Life Admin", openCount: 3 },
  { name: "phone", openCount: 0 }
]

const names = (typed: string, has: string[] = []): string[] =>
  tagSuggestions(all, typed, has).map(({ type, name }) => (type === SuggestionType.NEW ? `+${name}` : name))

describe("tagSuggestions", () => {
  it("offers every tag in use, most used first, with nothing typed", () => {
    expect(names("")).toEqual(["car", "Life Admin", "admin", "phone"])
  })

  it("offers those starting with what's typed first, then a new tag of it", () => {
    expect(names("ad")).toEqual(["admin", "Life Admin", "+ad"])
  })

  it("offers no new tag that's in use already, in any case, and leaves out what the task has", () => {
    expect(names("LIFE  admin")).toEqual(["Life Admin"])
    expect(names("admin", ["Life Admin"])).toEqual(["admin"])
    expect(names("car", ["car"])).toEqual([])
  })
})
