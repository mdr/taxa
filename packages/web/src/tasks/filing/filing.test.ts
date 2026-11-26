import { domainId } from "@taxa/shared/ids"
import { domainPrefix, type Domain } from "@taxa/shared/domains/domain"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { domainChoice, filedRequest, movedRequest } from "./filing.ts"

const home: Domain = {
  id: domainId("0190a1b2-0000-7000-8000-0000000000aa"),
  prefix: domainPrefix("H"),
  name: "Home",
  createdAt: "2026-01-05T09:00:00.000Z",
  version: 1
}

describe("filing", () => {
  it("shows which domain a task is in", () => {
    expect(domainChoice(makeTask({ domainId: home.id }), [home])).toBe("H")
    expect(domainChoice(makeTask(), [])).toBe("")
  })

  it("moves a task to the domain chosen", () => {
    expect(movedRequest("H")).toEqual({ set: { domain: "H" } })
  })

  it("files a task in the Inbox, or puts a filed one back", () => {
    expect(filedRequest(makeTask({ inbox: true }))).toEqual({ set: { inbox: false } })
    expect(filedRequest(makeTask())).toEqual({ set: { inbox: true } })
  })
})
