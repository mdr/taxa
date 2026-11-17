import { TaskStatus } from "@taxa/shared/tasks/task"
import { describe, expect, it } from "vite-plus/test"
import { startedOrStopped } from "./in-progress.ts"

describe("startedOrStopped", () => {
  it("starts a task that's open or waiting, and stops one in progress", () => {
    expect(startedOrStopped(TaskStatus.OPEN)).toBe(TaskStatus.IN_PROGRESS)
    expect(startedOrStopped(TaskStatus.WAITING)).toBe(TaskStatus.IN_PROGRESS)
    expect(startedOrStopped(TaskStatus.IN_PROGRESS)).toBe(TaskStatus.OPEN)
  })

  it("does nothing to a finished task", () => {
    expect(startedOrStopped(TaskStatus.DONE)).toBeUndefined()
    expect(startedOrStopped(TaskStatus.CANCELLED)).toBeUndefined()
  })
})
