import { describe, expect, it } from "vite-plus/test"
import { Priority, TaskStatus, type Task } from "./task.ts"
import { taskHighlights } from "./task-highlights.ts"

const makeTask = (fields: Partial<Task> = {}): Task => ({
  id: "0190a1b2-0000-7000-8000-000000000000",
  ref: "H-1",
  number: 1,
  domainId: "0190a1b2-0000-7000-8000-000000000001",
  title: "Fix the tap",
  notes: "",
  status: TaskStatus.OPEN,
  priority: Priority.NORMAL,
  inbox: false,
  createdAt: "2026-01-05T09:00:00.000Z",
  updatedAt: "2026-01-05T09:00:00.000Z",
  version: 1,
  ...fields
})

describe("taskHighlights", () => {
  it("says nothing about an ordinary open task", () => {
    expect(taskHighlights(makeTask(), "2026-01-05")).toEqual([])
  })

  it("names what's unusual, in a fixed order", () => {
    const task = makeTask({
      status: TaskStatus.WAITING,
      waitingOn: "Dave",
      priority: Priority.HIGH,
      due: "2026-01-09",
      scheduled: "2026-01-08",
      scheduledTime: "18:30",
      inbox: true
    })
    expect(taskHighlights(task, "2026-01-05")).toEqual([
      "waiting",
      "on Dave",
      "high",
      "due Fri 9 Jan",
      "scheduled Thu 8 Jan 18:30",
      "inbox"
    ])
  })
})
