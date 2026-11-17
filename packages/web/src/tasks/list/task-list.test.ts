import { TaskStatus } from "@taxa/shared/tasks/task"
import { describe, expect, it } from "vite-plus/test"
import { isHome, listQuery, ListType } from "./task-list.ts"

describe("task lists", () => {
  it("ask for the Inbox, a domain's tasks, or everything in progress", () => {
    expect(listQuery({ type: ListType.INBOX })).toEqual({ inbox: "true" })
    expect(listQuery({ type: ListType.DOMAIN, prefix: "h" })).toEqual({ domain: "h" })
    expect(listQuery({ type: ListType.IN_PROGRESS })).toEqual({ status: TaskStatus.IN_PROGRESS })
  })

  it("take new tasks only where tasks live", () => {
    expect(isHome({ type: ListType.INBOX })).toBe(true)
    expect(isHome({ type: ListType.DOMAIN, prefix: "H" })).toBe(true)
    expect(isHome({ type: ListType.IN_PROGRESS })).toBe(false)
  })
})
