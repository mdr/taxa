import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"
import { CONFLICT_NOTICE } from "../../src/tasks/changes/task-changes-service.ts"

const DAY = 24 * 60 * 60 * 1000

test("a list puts the most pressing first: priority, then the nearest due date", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Renew passport", { domain: "H" })
  await taxa.matt.addTask("Fix the tap", { domain: "H", due: "2026-01-09" })
  await taxa.matt.addTask("Pay the bill", { domain: "H", priority: Priority.URGENT })
  await taxa.matt.addTask("Sort the loft", { domain: "H", priority: Priority.LOW })
  await taxa.matt.addTask("Book the MOT", { domain: "H", due: "2026-01-06" })
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.sidebar.openDomain("Home")
  await list.expectTasks([
    "H-3 Pay the bill",
    "H-5 Book the MOT",
    "H-2 Fix the tap",
    "H-1 Renew passport",
    "H-4 Sort the loft"
  ])
  await list.expectHighlights("Pay the bill", "Urgent")
  await list.expectHighlights("Book the MOT", "Due Tue 6 Jan")
})

test("the Inbox count goes down as tasks are filed and finished", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.sidebar.expectInboxCount(0)
  await list.capture("Fix the tap")
  await list.capture("Renew passport")
  await list.sidebar.expectInboxCount(2)

  const detail = await list.openTask("Fix the tap")
  await detail.filing.file()
  await detail.sidebar.expectInboxCount(1)
  await detail.sidebar.openInbox()
  await list.complete("Renew passport")
  await list.sidebar.expectInboxCount(0)
})

test("an empty domain says so, and a deleted task leaves its list", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.delete()
  await (await detail.sidebar.openDomain("Home")).expectTasks([])
})

test("a task hidden until a later day leaves its list until that day", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.addTask("Plant the bulbs", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-2")
  await detail.hideUntil("2026-01-07")
  const list = await detail.sidebar.openDomain("Home")
  await list.expectTasks(["H-1 Fix the tap"])

  await taxa.advance(2 * DAY)
  await list.sidebar.openInbox()
  await list.sidebar.openDomain("Home")
  await list.expectTasks(["H-1 Fix the tap", "H-2 Plant the bulbs"])
})

test("the offer to undo goes after a few seconds, and the task stays done", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.sidebar.openDomain("Home")
  await list.complete("Fix the tap")
  await list.expectUndoOffered("Fix the tap")
  await list.expectUndoGoesAway()
  await list.expectTasks(["✓ H-1 Fix the tap"])
  await taxa.expectTask("H-1", { status: TaskStatus.DONE })
})

test("a tick the server refuses is taken back, and says why", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.sidebar.openDomain("Home")
  await list.expectTasks(["H-1 Fix the tap"])

  const claude = await taxa.matt.agent("Claude Code")
  await claude.changeTask("H-1", { priority: Priority.HIGH })
  await list.complete("Fix the tap")
  await list.expectRowProblem("Fix the tap", CONFLICT_NOTICE)
  await list.expectTasks(["H-1 Fix the tap"])
  await taxa.expectTask("H-1", { status: TaskStatus.OPEN })
})

test("a capture the server refuses says why, and keeps what was typed", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.captureExpectingProblem("x".repeat(501), "500")
  await taxa.expectTaskCount(0)
})

test("the sidebar says which version of Taxa this is", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.sidebar.expectVersion("test", "test")
})
