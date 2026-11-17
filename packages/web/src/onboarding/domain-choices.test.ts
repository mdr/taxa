import { describe, expect, it } from "vite-plus/test"
import { STARTING_CHOICES, prefixed, problemsOf, renamed, toCreate, toggled, withAnother } from "./domain-choices.ts"

describe("domain choices", () => {
  it("start with Personal and Home chosen, Work offered", () => {
    expect(toCreate(STARTING_CHOICES).map(({ name, prefix }) => `${prefix} ${name}`)).toEqual(["P Personal", "H Home"])
  })

  it("suggest a prefix as a new domain is named, avoiding the chosen ones", () => {
    const choices = renamed(withAnother(STARTING_CHOICES), 4, "Hobbies")
    expect(choices[3]).toMatchObject({ name: "Hobbies", prefix: "HO" })
  })

  it("stop suggesting once a prefix is typed", () => {
    const choices = renamed(prefixed(STARTING_CHOICES, 2, "hs"), 2, "House")
    expect(choices[1]).toMatchObject({ name: "House", prefix: "HS" })
  })

  it("flag a missing name, a bad prefix and a shared one", () => {
    let choices = withAnother(toggled(STARTING_CHOICES, 3))
    choices = prefixed(choices, 3, "P")
    expect(problemsOf(choices)).toEqual(
      new Map([
        [1, "Another domain has P too."],
        [3, "Another domain has P too."],
        [4, "Give it a name."]
      ])
    )
    expect(problemsOf(prefixed(STARTING_CHOICES, 1, "")).get(1)).toBe("The prefix needs 1 to 5 letters.")
  })

  it("ignore the ones not chosen", () => {
    expect(problemsOf(prefixed(STARTING_CHOICES, 3, "P"))).toEqual(new Map())
  })
})
