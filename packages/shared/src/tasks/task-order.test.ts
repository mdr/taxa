import { describe, expect, it } from "vite-plus/test"
import { compareTasks } from "./task-order.ts"
import { Priority } from "./task.ts"
import { makeTask } from "../test-support/make-task.ts"

describe("compareTasks", () => {
  it("puts urgent first, then the soonest due, then the oldest", () => {
    const tasks = [
      makeTask({ number: 1 }),
      makeTask({ number: 2, due: "2026-01-09" }),
      makeTask({ number: 3, priority: Priority.LOW, due: "2026-01-06" }),
      makeTask({ number: 4, due: "2026-01-08" }),
      makeTask({ number: 5, priority: Priority.URGENT })
    ]
    expect(tasks.sort(compareTasks).map((task) => task.number)).toEqual([5, 4, 2, 1, 3])
  })
})
