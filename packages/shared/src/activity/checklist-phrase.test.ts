import { describe, expect, it } from "vite-plus/test"
import { checklistPhrase } from "./checklist-phrase.ts"

const ID = [
  "0190f7a8-0000-7000-8000-000000000001",
  "0190f7a8-0000-7000-8000-000000000002",
  "0190f7a8-0000-7000-8000-000000000003"
]
const TASK = "0190f7a8-0000-7000-8000-0000000000aa"
const item = (n: number, text: string, done = false, taskId?: string): object => ({
  id: ID[n],
  text,
  done,
  ...(taskId && { taskId })
})

describe("checklistPhrase", () => {
  it("says which items were added, ticked, unticked, reworded, made tasks or removed", () => {
    expect(checklistPhrase({ to: [item(0, "Oxfam")] })).toBe("added “Oxfam” to the checklist")
    expect(
      checklistPhrase({ from: [item(0, "Oxfam")], to: [item(0, "Oxfam"), item(1, "Shelter"), item(2, "RSPB")] })
    ).toBe("added 2 items to the checklist")
    expect(checklistPhrase({ from: [item(0, "Oxfam")], to: [item(0, "Oxfam", true)] })).toBe("ticked “Oxfam”")
    expect(
      checklistPhrase({
        from: [item(0, "Oxfam", true), item(1, "Shelter", true)],
        to: [item(0, "Oxfam"), item(1, "Shelter")]
      })
    ).toBe("unticked 2 items")
    expect(checklistPhrase({ from: [item(0, "Oxfam")], to: [item(0, "Oxfam UK")] })).toBe(
      "changed “Oxfam” to “Oxfam UK”"
    )
    expect(checklistPhrase({ from: [item(0, "Oxfam")], to: [item(0, "Oxfam", false, TASK)] })).toBe(
      "made “Oxfam” a task of its own"
    )
    expect(checklistPhrase({ from: [item(0, "Oxfam"), item(1, "Shelter")], to: [item(1, "Shelter")] })).toBe(
      "removed “Oxfam” from the checklist"
    )
  })

  it("says which item was moved, or that several were", () => {
    const [oxfam, shelter, rspb] = [item(0, "Oxfam"), item(1, "Shelter"), item(2, "RSPB")]
    expect(checklistPhrase({ from: [oxfam, shelter, rspb], to: [shelter, rspb, oxfam] })).toBe("moved “Oxfam”")
    expect(checklistPhrase({ from: [oxfam, shelter, rspb], to: [rspb, oxfam, shelter] })).toBe("moved “RSPB”")
    expect(checklistPhrase({ from: [oxfam, shelter, rspb], to: [rspb, shelter, oxfam] })).toBe(
      "reordered the checklist"
    )
    expect(checklistPhrase({ from: [oxfam, shelter], to: [shelter] })).toBe("removed “Oxfam” from the checklist")
  })
})
