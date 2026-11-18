import { Horizon, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { needingAttention } from "./attention.ts"

const today = "2026-01-05"

describe("needingAttention", () => {
  it("finds what's due, overdue or urgent for soon and isn't planned for today, overdue longest first", () => {
    const tasks = [
      makeTask({ number: 1, title: "Urgent, soon", horizon: Horizon.SOON, priority: Priority.URGENT }),
      makeTask({ number: 2, title: "Due today", due: today }),
      makeTask({ number: 3, title: "Overdue", due: "2026-01-04" }),
      makeTask({ number: 4, title: "Overdue, but planned", due: "2026-01-04", scheduled: today }),
      makeTask({ number: 5, title: "Overdue, waiting", due: "2026-01-04", status: TaskStatus.WAITING }),
      makeTask({ number: 6, title: "Urgent, any time", priority: Priority.URGENT }),
      makeTask({ number: 7, title: "Soon, not urgent", horizon: Horizon.SOON }),
      makeTask({ number: 8, title: "Due, but planned Friday", due: "2026-01-09", scheduled: "2026-01-09" }),
      makeTask({ number: 9, title: "Overdue, planned Friday", due: "2026-01-02", scheduled: "2026-01-09" })
    ]
    expect(needingAttention(tasks, today).map(({ task, reason }) => [task.title, reason])).toEqual([
      ["Overdue, planned Friday", "Overdue since Fri 2 Jan"],
      ["Overdue", "Overdue since Sun 4 Jan"],
      ["Due today", "Due today"],
      ["Urgent, soon", "Soon · urgent"]
    ])
  })
})
