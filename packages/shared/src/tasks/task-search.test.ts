import { describe, expect, it } from "vite-plus/test"
import { TaskStatus } from "./task.ts"
import { makeTask } from "../test-support/make-task.ts"
import { matchesSearch, searchResults } from "./task-search.ts"

describe("matchesSearch", () => {
  const tap = makeTask({ title: "Fix the kitchen tap", notes: "Needs a new washer from Screwfix" })

  it("finds a task by every word typed, in its title or notes, in any order or case", () => {
    expect(matchesSearch(tap, "tap")).toBe(true)
    expect(matchesSearch(tap, "KITCHEN fix")).toBe(true)
    expect(matchesSearch(tap, "washer")).toBe(true)
    expect(matchesSearch(tap, "tap washer")).toBe(true)
    expect(matchesSearch(tap, "kit")).toBe(true)
  })

  it("doesn't find it if any word is in neither", () => {
    expect(matchesSearch(tap, "tap boiler")).toBe(false)
  })

  it("finds it by what its comments say, as well", () => {
    expect(matchesSearch({ ...tap, comments: ["Plumber's coming Thursday"] }, "tap thursday")).toBe(true)
    expect(matchesSearch(tap, "thursday")).toBe(false)
  })

  it("finds everything when nothing's typed", () => {
    expect(matchesSearch(tap, "  ")).toBe(true)
  })
})

describe("searchResults", () => {
  it("puts tasks still to do first, and title matches before notes matches", () => {
    const notesOnly = makeTask({ title: "Call the plumber", notes: "About the tap" })
    const doneTitle = makeTask({ title: "Order a tap", status: TaskStatus.DONE })
    const title = makeTask({ title: "Fix the tap", status: TaskStatus.WAITING })
    const unrelated = makeTask({ title: "Bleed the radiators" })
    expect(searchResults([notesOnly, doneTitle, unrelated, title], "tap").map(({ title }) => title)).toEqual([
      "Fix the tap",
      "Call the plumber",
      "Order a tap"
    ])
  })

  it("finds tasks by their comments, after those found by their title", () => {
    const commented = makeTask({ title: "Call the plumber" })
    const title = makeTask({ title: "Fix the tap" })
    const comments = new Map([[commented, ["He'll bring a new tap"]]])
    expect(
      searchResults([commented, title], "tap", (task) => comments.get(task) ?? []).map(({ title }) => title)
    ).toEqual(["Fix the tap", "Call the plumber"])
  })
})
