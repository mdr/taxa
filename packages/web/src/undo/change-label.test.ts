import { TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { TaskChangeType } from "../tasks/changes/task-changes-service.ts"
import { addedLabel, changeLabel } from "./change-label.ts"

const task = makeTask({ number: 3, title: "Fix the tap" })

describe("changeLabel", () => {
  it("says what a change did to the task, by its ref", () => {
    expect(changeLabel({ type: TaskChangeType.STATUS, request: { status: TaskStatus.DONE } }, task)).toBe(
      `Marked ${task.ref} done`
    )
    expect(changeLabel({ type: TaskChangeType.STATUS, request: { status: TaskStatus.OPEN } }, task)).toBe(
      `Reopened ${task.ref}`
    )
    expect(changeLabel({ type: TaskChangeType.DELETE }, task)).toBe(`Deleted ${task.ref}`)
    expect(changeLabel({ type: TaskChangeType.UPDATE, request: { set: { title: "Fix it" } } }, task)).toBe(
      `Renamed ${task.ref}`
    )
    expect(changeLabel({ type: TaskChangeType.UPDATE, request: { set: { domain: "H" } } }, task)).toBe(
      `Moved ${task.ref}`
    )
    expect(changeLabel({ type: TaskChangeType.UPDATE, request: { addTags: ["errand"] } }, task)).toBe(
      `Changed the tags on ${task.ref}`
    )
    expect(changeLabel({ type: TaskChangeType.UPDATE, request: { clear: [] } }, task)).toBe(`Changed ${task.ref}`)
    expect(addedLabel(task)).toBe(`Added ${task.ref}`)
  })
})
