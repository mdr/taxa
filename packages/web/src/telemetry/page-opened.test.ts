import { describe, expect, it } from "vite-plus/test"
import { Page, pageOpened } from "./page-opened.ts"

describe("pageOpened", () => {
  it("names the page and what it's about", () => {
    expect(pageOpened("/")).toEqual({ page: Page.INBOX })
    expect(pageOpened("/in-progress")).toEqual({ page: Page.IN_PROGRESS })
    expect(pageOpened("/session")).toEqual({ page: Page.SESSION })
    expect(pageOpened("/today")).toEqual({ page: Page.TODAY })
    expect(pageOpened("/today/plan")).toEqual({ page: Page.PLAN_TODAY })
    expect(pageOpened("/soon")).toEqual({ page: Page.SOON })
    expect(pageOpened("/someday")).toEqual({ page: Page.SOMEDAY })
    expect(pageOpened("/bin")).toEqual({ page: Page.BIN })
    expect(pageOpened("/sessions/0190a1b2-0000-7000-8000-5e5510000001")).toEqual({
      page: Page.SESSION_SUMMARY,
      sessionId: "0190a1b2-0000-7000-8000-5e5510000001"
    })
    expect(pageOpened("/domains/h")).toEqual({ page: Page.DOMAIN, domainPrefix: "H" })
    expect(pageOpened("/tasks/h-12")).toEqual({ page: Page.TASK, taskRef: "H-12" })
    expect(pageOpened("/elsewhere")).toEqual({ page: Page.NOT_FOUND })
  })
})
