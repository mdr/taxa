import { TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { restoringStatus } from "./restore-status.ts"

describe("restoringStatus", () => {
  it("puts back the status, with what it was waiting on or why it was cancelled", () => {
    expect(restoringStatus(makeTask({ status: TaskStatus.OPEN }))).toEqual({ status: TaskStatus.OPEN })
    expect(restoringStatus(makeTask({ status: TaskStatus.IN_PROGRESS }))).toEqual({ status: TaskStatus.IN_PROGRESS })
    expect(
      restoringStatus(makeTask({ status: TaskStatus.WAITING, waitingOn: "the plumber", followUp: "2026-01-12" }))
    ).toEqual({ status: TaskStatus.WAITING, waitingOn: "the plumber", followUp: "2026-01-12" })
    expect(restoringStatus(makeTask({ status: TaskStatus.CANCELLED, cancelledReason: "moved house" }))).toEqual({
      status: TaskStatus.CANCELLED,
      reason: "moved house"
    })
  })
})
