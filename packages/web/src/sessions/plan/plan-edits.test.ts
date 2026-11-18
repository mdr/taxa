import { taskId } from "@taxa/shared/ids"
import { describe, expect, it } from "vite-plus/test"
import { addEntry, Direction, minuteChoices, moveEntry, removeEntry, setMinutes, totalMinutes } from "./plan-edits.ts"

const a = taskId("0190a1b2-0000-7000-8000-000000000001")
const b = taskId("0190a1b2-0000-7000-8000-000000000002")
const c = taskId("0190a1b2-0000-7000-8000-000000000003")
const plan = [
  { taskId: a, minutes: 30 },
  { taskId: b, minutes: 45 }
]

describe("plan edits", () => {
  it("add a task once, at the end, and take one out", () => {
    expect(addEntry(plan, { taskId: c, minutes: 20 }).map(({ taskId }) => taskId)).toEqual([a, b, c])
    expect(addEntry(plan, { taskId: a, minutes: 20 })).toEqual(plan)
    expect(removeEntry(plan, a)).toEqual([{ taskId: b, minutes: 45 }])
  })

  it("move a task up or down, staying put at either end", () => {
    expect(moveEntry(plan, b, Direction.UP).map(({ taskId }) => taskId)).toEqual([b, a])
    expect(moveEntry(plan, a, Direction.DOWN).map(({ taskId }) => taskId)).toEqual([b, a])
    expect(moveEntry(plan, a, Direction.UP)).toEqual(plan)
    expect(moveEntry(plan, b, Direction.DOWN)).toEqual(plan)
  })

  it("change a task's time, and add the times up", () => {
    expect(setMinutes(plan, b, 60)).toEqual([
      { taskId: a, minutes: 30 },
      { taskId: b, minutes: 60 }
    ])
    expect(totalMinutes(plan)).toBe(75)
  })

  it("offer common lengths, and the one a task has", () => {
    expect(minuteChoices(30)).toContain(30)
    expect(minuteChoices(35)).toContain(35)
    expect(minuteChoices(35).indexOf(35)).toBe(minuteChoices(35).indexOf(30) + 1)
  })
})
