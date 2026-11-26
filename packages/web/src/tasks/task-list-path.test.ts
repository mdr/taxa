import { domainPrefix } from "@taxa/shared/domains/domain"
import { domainId } from "@taxa/shared/ids"
import type { Domain } from "@taxa/shared/domains/domain"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { taskListPath } from "./task-list-path.ts"

describe("taskListPath", () => {
  const home: Domain = {
    id: domainId("0190a1b2-0000-7000-8000-0000000000aa"),
    prefix: domainPrefix("H"),
    name: "Home",
    createdAt: "2026-01-05T09:00:00.000Z",
    version: 1
  }
  const task = makeTask({ domainId: home.id })

  it("is the task's domain", () => {
    expect(taskListPath(task, [home])).toBe("/domains/H")
  })

  it("is the Inbox for a task in it, or one not loaded yet", () => {
    expect(taskListPath({ ...task, inbox: true }, [home])).toBe("/")
    expect(taskListPath(undefined, [home])).toBe("/")
    expect(taskListPath(task, undefined)).toBe("/")
  })
})
