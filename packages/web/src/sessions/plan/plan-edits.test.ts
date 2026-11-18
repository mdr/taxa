import { taskId } from "@taxa/shared/ids"
import { describe, expect, it } from "vite-plus/test"
import { addEntry, moveEntry, removeEntry, setMinutes, totalMinutes } from "./plan-edits.ts"

const a = taskId("0190a1b2-0000-7000-8000-000000000001")
const b = taskId("0190a1b2-0000-7000-8000-000000000002")
const c = taskId("0190a1b2-0000-7000-8000-000000000003")
const plan = [
  { taskId: a, minutes: 30 },
  { taskId: b, minutes: 45 },
  { taskId: c, minutes: 20 }
]
const order = (entries: readonly { taskId: string }[]): string[] =>
  entries.map(({ taskId: id }) => ({ [a]: "a", [b]: "b", [c]: "c" })[id] ?? "?")

describe("plan edits", () => {
  it("add a task once, at the end or where it's dropped", () => {
    const d = taskId("0190a1b2-0000-7000-8000-000000000004")
    expect(addEntry(plan, { taskId: d, minutes: 10 }).at(-1)?.taskId).toBe(d)
    expect(addEntry(plan, { taskId: d, minutes: 10 }, 1).map(({ taskId: id }) => id)).toEqual([a, d, b, c])
    expect(addEntry(plan, { taskId: d, minutes: 10 }, 99).at(-1)?.taskId).toBe(d)
    expect(addEntry(plan, { taskId: a, minutes: 20 })).toEqual(plan)
  })

  it("take a task out", () => {
    expect(order(removeEntry(plan, a))).toEqual(["b", "c"])
  })

  it("move a task to where it's dragged, either way, staying in bounds", () => {
    expect(order(moveEntry(plan, a, 2))).toEqual(["b", "c", "a"])
    expect(order(moveEntry(plan, c, 0))).toEqual(["c", "a", "b"])
    expect(order(moveEntry(plan, b, 1))).toEqual(["a", "b", "c"])
    expect(order(moveEntry(plan, a, 9))).toEqual(["b", "c", "a"])
  })

  it("change a task's time, and add the times up", () => {
    expect(setMinutes(plan, b, 60)[1]).toEqual({ taskId: b, minutes: 60 })
    expect(totalMinutes(plan)).toBe(95)
  })
})
