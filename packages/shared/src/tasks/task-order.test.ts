import { describe, expect, it } from "vite-plus/test"
import { compareTasks } from "./task-order.ts"
import { Priority, TaskStatus, type Task } from "./task.ts"

const makeTask = (number: number, overrides: Partial<Task> = {}): Task => ({
  id: `00000000-0000-7000-8000-${String(number).padStart(12, "0")}`,
  ref: `H-${number}`,
  number,
  domainId: "00000000-0000-7000-8000-000000000000",
  title: `Task ${number}`,
  notes: "",
  status: TaskStatus.OPEN,
  priority: Priority.NORMAL,
  inbox: false,
  createdAt: "2026-01-05T09:00:00.000Z",
  updatedAt: "2026-01-05T09:00:00.000Z",
  version: 1,
  ...overrides
})

describe("compareTasks", () => {
  it("puts urgent first, then the soonest due, then the oldest", () => {
    const tasks = [
      makeTask(1),
      makeTask(2, { due: "2026-01-09" }),
      makeTask(3, { priority: Priority.LOW, due: "2026-01-06" }),
      makeTask(4, { due: "2026-01-08" }),
      makeTask(5, { priority: Priority.URGENT })
    ]
    expect(tasks.sort(compareTasks).map((task) => task.number)).toEqual([5, 4, 2, 1, 3])
  })
})
