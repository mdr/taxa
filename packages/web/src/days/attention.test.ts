import { Horizon, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { needingAttention } from "./attention.ts"

describe("needingAttention", () => {
  it("finds what's urgent and lined up for soon, leaving deadlines to their own box", () => {
    const tasks = [
      makeTask({ number: 1, title: "Urgent, soon", horizon: Horizon.SOON, priority: Priority.URGENT }),
      makeTask({ number: 2, title: "Overdue", due: "2026-01-04" }),
      makeTask({ number: 3, title: "Urgent, any time", priority: Priority.URGENT }),
      makeTask({ number: 4, title: "Soon, not urgent", horizon: Horizon.SOON }),
      makeTask({
        number: 5,
        title: "Urgent, soon, waiting",
        horizon: Horizon.SOON,
        priority: Priority.URGENT,
        status: TaskStatus.WAITING
      })
    ]
    expect(needingAttention(tasks).map(({ task, reason }) => [task.title, reason])).toEqual([
      ["Urgent, soon", "Soon · urgent"]
    ])
  })
})
