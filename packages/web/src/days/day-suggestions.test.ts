import { Horizon, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { daySuggestions } from "./day-suggestions.ts"

const today = "2026-01-05"

describe("daySuggestions", () => {
  const tasks = [
    makeTask({ number: 1, title: "Whenever" }),
    makeTask({ number: 2, title: "Important", priority: Priority.HIGH }),
    makeTask({ number: 3, title: "Due Thursday", due: "2026-01-08" }),
    makeTask({ number: 4, title: "Lined up", horizon: Horizon.SOON }),
    makeTask({ number: 5, title: "Under way", status: TaskStatus.IN_PROGRESS }),
    makeTask({ number: 6, title: "Overdue", due: "2026-01-02" }),
    makeTask({ number: 7, title: "Planned today", scheduled: "2026-01-05" }),
    makeTask({ number: 8, title: "Planned Friday", scheduled: "2026-01-09" }),
    makeTask({ number: 9, title: "Waiting", status: TaskStatus.WAITING, due: "2026-01-05" })
  ]

  it("offers what pulls hardest first, leaving out today's, another day's and waiting ones", () => {
    expect(daySuggestions(tasks, today, [], "").map(({ title }) => title)).toEqual([
      "Overdue",
      "Under way",
      "Lined up",
      "Due Thursday",
      "Important"
    ])
  })

  it("leaves out what's been put in the plan", () => {
    expect(daySuggestions(tasks, today, [tasks[5]!.id], "").map(({ title }) => title)).not.toContain("Overdue")
  })

  it("finds any of the rest by title or ref, another day's too", () => {
    expect(daySuggestions(tasks, today, [], "plan").map(({ title }) => title)).toEqual(["Planned Friday"])
    expect(daySuggestions(tasks, today, [], "  WHEN ").map(({ title }) => title)).toEqual(["Whenever"])
  })
})
