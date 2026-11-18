import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { describe, expect, it } from "vite-plus/test"
import { setOrClear } from "./field-change.ts"
import { TaskChangeType } from "./task-changes-service.ts"

describe("setOrClear", () => {
  it("sets a value given, and clears the field without one", () => {
    expect(setOrClear(ClearableField.DUE, "2026-01-09")).toEqual({
      type: TaskChangeType.UPDATE,
      request: { set: { due: "2026-01-09" } }
    })
    expect(setOrClear(ClearableField.ESTIMATE_MINUTES, undefined)).toEqual({
      type: TaskChangeType.UPDATE,
      request: { clear: [ClearableField.ESTIMATE_MINUTES] }
    })
  })
})
