import { domainId } from "@taxa/shared/ids"
import { domainPrefix, type Domain } from "@taxa/shared/domains/domain"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { INBOX_CHOICE, filingChoice, filingRequest } from "./filing.ts"

const home: Domain = {
  id: domainId("0190a1b2-0000-7000-8000-0000000000aa"),
  prefix: domainPrefix("H"),
  name: "Home",
  createdAt: "2026-01-05T09:00:00.000Z",
  version: 1
}

describe("filing", () => {
  it("shows where a task is: the Inbox, or its domain", () => {
    expect(filingChoice(makeTask({ inbox: true, domainId: undefined }), [home])).toBe(INBOX_CHOICE)
    expect(filingChoice(makeTask({ domainId: home.id }), [home])).toBe("H")
    expect(filingChoice(makeTask(), [])).toBe("")
  })

  it("files a task in the domain chosen, or puts it back in the Inbox", () => {
    expect(filingRequest("H")).toEqual({ set: { domain: "H" } })
    expect(filingRequest(INBOX_CHOICE)).toEqual({ set: { inbox: true } })
  })
})
