import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { testTelemetry } from "../../test-support/test-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { FollowOnService } from "./follow-on-service.ts"

describe("FollowOnService", () => {
  it("opens the dialog for a follow-on, tracked, and closes it", () => {
    const telemetry = testTelemetry()
    const service = new FollowOnService(telemetry.analytics)
    const task = makeTask({ number: 7, title: "Back up the disks" })
    service.start(task)
    expect(service.state.from).toBe(task)
    expect(telemetry.tracked()).toEqual([
      [ANALYTICS_CODES.task.followOnStarted, { taskId: task.id, taskRef: task.ref }]
    ])
    service.end()
    expect(service.state.from).toBeUndefined()
  })
})
