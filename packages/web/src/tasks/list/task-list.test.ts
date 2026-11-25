import { TaskStatus } from "@taxa/shared/tasks/task"
import { describe, expect, it } from "vite-plus/test"
import { When } from "@taxa/shared/tasks/when"
import { capturesWhen, isHome, listQuery, ListType } from "./task-list.ts"

describe("task lists", () => {
  it("ask for the Inbox, a domain's tasks, or everything in progress", () => {
    expect(listQuery({ type: ListType.INBOX })).toEqual({ inbox: "true" })
    expect(listQuery({ type: ListType.DOMAIN, prefix: "h" })).toEqual({ domain: "h" })
    expect(listQuery({ type: ListType.IN_PROGRESS })).toEqual({ status: TaskStatus.IN_PROGRESS })
  })

  it("ask for what's meant for today, soon or someday", () => {
    expect(listQuery({ type: ListType.TODAY })).toEqual({ when: "TODAY" })
    expect(listQuery({ type: ListType.SOON })).toEqual({ when: "SOON" })
    expect(listQuery({ type: ListType.SOMEDAY })).toEqual({ when: "SOMEDAY" })
  })

  it("are homes only where tasks live", () => {
    expect(isHome({ type: ListType.INBOX })).toBe(true)
    expect(isHome({ type: ListType.DOMAIN, prefix: "H" })).toBe(true)
    expect(isHome({ type: ListType.IN_PROGRESS })).toBe(false)
    expect(isHome({ type: ListType.TODAY })).toBe(false)
  })

  it("take new tasks for today or soon in those views, and not in others across lists", () => {
    expect(capturesWhen({ type: ListType.TODAY })).toBe(When.TODAY)
    expect(capturesWhen({ type: ListType.SOON })).toBe(When.SOON)
    expect(capturesWhen({ type: ListType.SOMEDAY })).toBeUndefined()
    expect(capturesWhen({ type: ListType.IN_PROGRESS })).toBeUndefined()
    expect(capturesWhen({ type: ListType.INBOX })).toBeUndefined()
  })
})
