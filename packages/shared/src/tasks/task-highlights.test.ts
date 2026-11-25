import { describe, expect, it } from "vite-plus/test"
import { Priority, TaskStatus } from "./task.ts"
import { makeTask } from "../test-support/make-task.ts"
import { taskHighlights } from "./task-highlights.ts"
import { checklistItemId } from "../ids.ts"

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
      checklist: [
        { id: checklistItemId("0190f7a8-0000-7000-8000-000000000001"), text: "Oxfam", done: true },
        { id: checklistItemId("0190f7a8-0000-7000-8000-000000000002"), text: "Shelter", done: false }
      ],
      inbox: true
    })
    expect(taskHighlights(task, "2026-01-05")).toEqual([
      "waiting",
      "on Dave",
      "high",
      "due Fri 9 Jan",
      "scheduled Thu 8 Jan 18:30",
      "checklist 1/2",
      "inbox"
    ])
  })
})
