import { domainPrefix } from "@taxa/shared/domains/domain"
import type { Domain } from "@taxa/shared/domains/domain"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { taskListPath } from "./task-list-path.ts"

describe("taskListPath", () => {
  const task = makeTask()
  const home: Domain = {
    id: task.domainId,
    prefix: domainPrefix("H"),
    name: "Home",
    createdAt: "2026-01-05T09:00:00.000Z",
    version: 1
  }

  it("is the task's domain", () => {
    expect(taskListPath(task, [home])).toBe("/domains/H")
  })

  it("is the Inbox for a task in it, or one not loaded yet", () => {
    expect(taskListPath({ ...task, inbox: true }, [home])).toBe("/")
    expect(taskListPath(undefined, [home])).toBe("/")
    expect(taskListPath(task, undefined)).toBe("/")
  })
})
