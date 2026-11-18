import { describe, expect, it } from "vite-plus/test"
import type { TaskId } from "../ids.ts"
import { inPlanOrder } from "./day-plan.ts"

const task = (id: string): { id: TaskId } => ({ id: id as TaskId })

describe("inPlanOrder", () => {
  it("puts tasks in the plan's order, then the rest as they came", () => {
    const tasks = [task("a"), task("b"), task("c"), task("d")]
    expect(inPlanOrder(tasks, ["c", "a"] as TaskId[]).map(({ id }) => id)).toEqual(["c", "a", "b", "d"])
  })

  it("passes over planned tasks that aren't there", () => {
    expect(inPlanOrder([task("a"), task("b")], ["x", "b"] as TaskId[]).map(({ id }) => id)).toEqual(["b", "a"])
  })
})
