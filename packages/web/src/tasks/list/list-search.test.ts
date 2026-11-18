import { TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { listSearch } from "./list-search.ts"

const tap = makeTask({ title: "Fix the tap" })
const radiators = makeTask({ title: "Bleed the radiators", notes: "Key's in the drawer" })
const washer = makeTask({ title: "Buy a tap washer", status: TaskStatus.DONE })

const titles = (tasks: readonly { title: string }[] | undefined): string[] | undefined =>
  tasks?.map(({ title }) => title)

describe("listSearch", () => {
  it("shows everything, finished tasks only when asked for, with nothing typed", () => {
    const shown = listSearch([tap, radiators], [washer], " ", false)
    expect(titles(shown.open)).toEqual(["Fix the tap", "Bleed the radiators"])
    expect(shown.completedOpen).toBe(false)
    expect(shown.noMatches).toBeUndefined()
    expect(listSearch([tap], [washer], "", true).completedOpen).toBe(true)
  })

  it("shows what a search finds, finished tasks included", () => {
    const shown = listSearch([tap, radiators], [washer], "tap", false)
    expect(titles(shown.open)).toEqual(["Fix the tap"])
    expect(titles(shown.completed)).toEqual(["Buy a tap washer"])
    expect(shown.completedOpen).toBe(true)
    expect(titles(listSearch([tap, radiators], [washer], "drawer", false).open)).toEqual(["Bleed the radiators"])
  })

  it("says when a search finds nothing still to do, or nothing at all", () => {
    expect(listSearch([tap], [washer], "washer", false).noMatches).toBe("Nothing still to do matches")
    expect(listSearch([tap], [washer], " boiler ", false).noMatches).toBe("Nothing here matches “boiler”")
  })

  it("waits for the list to load", () => {
    expect(listSearch(undefined, [], "tap", false)).toEqual({
      open: undefined,
      completed: [],
      completedOpen: false,
      noMatches: undefined
    })
  })
})
