import { TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("capturing to the Inbox and filing a task", async ({ taxa }) => {
  const inbox = await (await (await taxa.openTab("Matt")).openFirstTime()).start()
  await inbox.sidebar.addDomain("Hobbies", "H")
  await inbox.sidebar.expectDomainProblem("H")

  await inbox.capture("Fix the tap")
  await inbox.capture("Renew passport")
  await inbox.expectTasks(["IN-1 Fix the tap", "IN-2 Renew passport"])
  await inbox.expectAccessible()
  // Not filed anywhere yet, so in no domain's list.
  await inbox.sidebar.openDomain("Personal")
  await inbox.expectTasks([])
  await inbox.sidebar.openInbox()

  const detail = await inbox.openTask("Fix the tap")
  await detail.moveTo("H")
  await detail.expectRef("H-1")
  await detail.sidebar.openInbox()
  await inbox.expectTasks(["IN-2 Renew passport"])
  await inbox.file("Renew passport", "P")
  await inbox.expectTasks([])
  await inbox.sidebar.openDomain("Home")
  await inbox.expectHeading("Home")
  await inbox.expectTasks(["H-1 Fix the tap"])
  await inbox.sidebar.openDomain("Personal")
  await inbox.expectTasks(["P-2 Renew passport"])
})

test("filing the Inbox from the keyboard, one task after another", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addDomain("Work", "W")
  await taxa.matt.addTask("Fix the tap")
  await taxa.matt.addTask("Plan the quarter")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.expectTasks(["IN-1 Fix the tap", "IN-2 Plan the quarter"])

  await inbox.keyboard.press("j")
  await inbox.expectHighlighted("Fix the tap")
  await inbox.keyboard.choose("m", "H")
  await inbox.expectTasks(["IN-2 Plan the quarter"])
  await inbox.expectHighlighted("Plan the quarter")
  await inbox.keyboard.choose("m", "W")
  await inbox.expectTasks([])
  await taxa.expectTask("W-2", { title: "Plan the quarter" })
})

test("putting a task back in the Inbox", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.moveTo("IN")
  await detail.expectRef("IN-1")
  const inbox = await detail.sidebar.openInbox()
  await inbox.expectTasks(["IN-1 Fix the tap"])
})

test("what people do is tracked, from starting the app to capturing and changing a task", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const tab = await taxa.openTab("Matt")
  const inbox = await tab.openInbox()
  await inbox.capture("Fix the tap")
  const detail = await inbox.openTask("Fix the tap")
  await detail.moveTo("H")
  await detail.expectRef("H-1")
  await tab.expectLogged(["app.started", "nav.pageOpened", "task.captured", "nav.pageOpened", "task.changed"])
})

test("a new domain's prefix is suggested from its name", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.addDomainSuggested("Hobbies")
  await inbox.sidebar.expectDomains(["H Home", "HO Hobbies"])
})

test("a task captured in a domain's list goes straight into it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.openDomain("Home")
  await inbox.capture("Bleed the radiators")
  await inbox.expectTasks(["H-1 Bleed the radiators"])
  await taxa.expectTask("H-1", { inbox: false })
})

test("a ticked-off task stays in place until you leave, with a chance to undo", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H", due: "2026-01-09" })
  await taxa.matt.addTask("Renew passport", { domain: "H" })
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.sidebar.openDomain("Home")
  await list.expectHighlights("Fix the tap", "Due Fri 9 Jan")

  await list.complete("Fix the tap")
  await list.expectTasks(["✓ H-1 Fix the tap", "H-2 Renew passport"])
  await list.expectUndoOffered("Fix the tap")
  await list.expectAccessible()
  await taxa.expectTask("H-1", { status: TaskStatus.DONE })

  await list.undo()
  await list.expectTasks(["H-1 Fix the tap", "H-2 Renew passport"])
  await taxa.expectTask("H-1", { status: TaskStatus.OPEN })
})

test("finished tasks can be found again, and unticked", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.addTask("Renew passport", { domain: "H" })
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.sidebar.openDomain("Home")
  await list.complete("Fix the tap")
  await list.expectTasks(["✓ H-1 Fix the tap", "H-2 Renew passport"])

  await list.sidebar.openInbox()
  await list.sidebar.openDomain("Home")
  await list.expectTasks(["H-2 Renew passport"])
  await list.showCompleted()
  await list.expectCompleted(["✓ H-1 Fix the tap"])
  await list.reopen("Fix the tap")
  await list.expectTasks(["H-1 Fix the tap", "H-2 Renew passport"])
  await taxa.expectTask("H-1", { status: TaskStatus.OPEN })
})
