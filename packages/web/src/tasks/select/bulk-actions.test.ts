import { describe, expect, it } from "vite-plus/test"
import { OccurrenceOutcome, RepeatFrom, RepeatUnit } from "@taxa/shared/tasks/repeat"
import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { When } from "@taxa/shared/tasks/when"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { TaskChangeType } from "../changes/task-changes-service.ts"
import { appliesTo, BulkActionType, bulkLabel, changeFor } from "./bulk-actions.ts"

const TODAY = "2026-11-27"

describe("bulk actions", () => {
  it("marks a repeating task done this time, as its tick does, and others done", () => {
    const repeating = makeTask({ repeat: { every: 1, unit: RepeatUnit.DAY, from: RepeatFrom.SCHEDULE } as never })
    expect(changeFor({ type: BulkActionType.DONE }, repeating, TODAY)).toEqual({
      type: TaskChangeType.OCCURRENCE,
      request: { outcome: OccurrenceOutcome.DONE }
    })
    expect(changeFor({ type: BulkActionType.DONE }, makeTask(), TODAY)).toEqual({
      type: TaskChangeType.STATUS,
      request: { status: TaskStatus.DONE }
    })
  })

  it("files only those in the Inbox", () => {
    const tasks = [makeTask({ number: 1, inbox: true }), makeTask({ number: 2, inbox: false })]
    expect(appliesTo({ type: BulkActionType.FILE }, tasks).map(({ number }) => number)).toEqual([1])
  })

  it("says what it did", () => {
    expect(bulkLabel({ type: BulkActionType.MOVE, prefix: "W", name: "Work" }, 3, TODAY)).toBe("Moved 3 tasks to Work")
    expect(bulkLabel({ type: BulkActionType.PRIORITY, priority: Priority.HIGH }, 1, TODAY)).toBe(
      "1 task: high priority"
    )
    expect(bulkLabel({ type: BulkActionType.STATUS, status: TaskStatus.IN_PROGRESS }, 2, TODAY)).toBe(
      "2 tasks in progress"
    )
    expect(bulkLabel({ type: BulkActionType.WHEN, when: When.ON_A_DAY, day: "2026-12-01" }, 2, TODAY)).toBe(
      "2 tasks: on Tue 1 Dec"
    )
  })
})
