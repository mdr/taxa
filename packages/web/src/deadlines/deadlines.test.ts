import { TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { comingUp, countdown, deadlineGroups, deadlineReason } from "./deadlines.ts"

/** A Thursday. */
const today = "2026-11-26"

describe("deadlineGroups", () => {
  it("puts deadlines under overdue, today, this week, next week, then each month", () => {
    const dues = ["2026-11-20", "2026-11-26", "2026-11-29", "2026-11-30", "2026-12-06", "2026-12-07", "2026-12-31"]
    const tasks = [...dues, "2027-01-31", "2027-03-09"].map((due, index) => makeTask({ number: index + 1, due }))
    expect(
      deadlineGroups([...tasks, makeTask({ number: 99 })], today).map(({ name, tasks }) => [name, tasks.length])
    ).toEqual([
      ["Overdue", 1],
      ["Today", 1],
      ["This week", 1],
      ["Next week", 2],
      ["December", 2],
      ["January 2027", 1],
      ["March 2027", 1]
    ])
  })

  it("has no this week on a Sunday, only today", () => {
    const tasks = [makeTask({ number: 1, due: "2026-11-29" }), makeTask({ number: 2, due: "2026-11-30" })]
    expect(deadlineGroups(tasks, "2026-11-29").map(({ name }) => name)).toEqual(["Today", "Next week"])
  })
})

describe("countdown", () => {
  it("says how long until a deadline, or how late it is", () => {
    expect(
      ["2026-11-23", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-29", "2026-12-10", "2026-12-14"].map((due) =>
        countdown(due, today)
      )
    ).toEqual(["3 days late", "1 day late", "today", "tomorrow", "in 3 days", "in 2 weeks", "in 3 weeks"])
    expect(countdown("2027-01-31", today)).toBe("in 2 months")
    expect(countdown("2027-03-09", today)).toBe("in 3 months")
  })
})

describe("comingUp", () => {
  it("finds what's overdue or due within a week, not planned for today nor waiting", () => {
    const tasks = [
      makeTask({ number: 1, title: "Overdue", due: "2026-11-23" }),
      makeTask({ number: 2, title: "Due in six days", due: "2026-12-02" }),
      makeTask({ number: 3, title: "Due in a week", due: "2026-12-03" }),
      makeTask({ number: 4, title: "Due, planned today", due: "2026-11-27", scheduled: today }),
      makeTask({ number: 5, title: "Due, planned Saturday", due: "2026-11-29", scheduled: "2026-11-28" }),
      makeTask({ number: 6, title: "Due, waiting", due: "2026-11-27", status: TaskStatus.WAITING }),
      makeTask({ number: 7, title: "No deadline" })
    ]
    expect(comingUp(tasks, today).map(({ title }) => title)).toEqual([
      "Overdue",
      "Due in six days",
      "Due, planned Saturday"
    ])
  })

  it("says why each is coming up", () => {
    expect(["2026-11-23", today, "2026-11-29"].map((due) => deadlineReason(due, today))).toEqual([
      "Overdue since Mon 23 Nov",
      "Due today",
      "Due Sun 29 Nov · in 3 days"
    ])
  })
})
