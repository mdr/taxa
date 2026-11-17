import { test } from "../fixtures/taxa-fixture.ts"

test("adding tasks and moving between lists from the keyboard", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addDomain("Work", "WK")
  const tab = await taxa.openTab("Matt")
  const inbox = await tab.openInbox()

  // c and g in a title are typed, not taken as shortcuts.
  await inbox.keyboard.addTask("Get coffee")
  await inbox.expectTasks(["H-1 Get coffee"])

  const work = await inbox.keyboard.goTo("g w k")
  await work.expectHeading("Work")
  await work.keyboard.addTask("Plan the quarter")
  await work.expectTasks(["WK-2 Plan the quarter"])

  const home = await work.keyboard.goTo("g h")
  await home.expectHeading("Home")
  await (await home.keyboard.goTo("g i")).expectHeading("Inbox")

  // From a task's page, C adds to the list the task is in.
  const detail = await tab.openTask("WK-2")
  await detail.expectRef("WK-2")
  const list = await detail.keyboard.addTask("Book the offsite")
  await list.expectHeading("Work")
  await list.expectTasks(["WK-2 Plan the quarter", "WK-3 Book the offsite"])
})

test("undoing ticking a task off from the keyboard", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const home = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openDomain("Home"))
  await home.complete("Fix the tap")
  await home.expectUndoOffered("Fix the tap")

  await home.keyboard.press("mod+z")
  await home.expectTasks(["H-1 Fix the tap"])
  await home.expectUndoGoesAway()
})

test("the list of shortcuts, and turning single-key ones off", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const inbox = await (await taxa.openTab("Matt")).openInbox()

  const help = await inbox.keyboard.openShortcuts()
  await help.expectShortcuts([
    "Add a task C",
    "Show keyboard shortcuts ?",
    "Inbox G then I",
    "Home G then H",
    "Undo ticking a task off ⌘Z"
  ])
  await help.expectAccessible()
  await help.setSingleKeys(false)
  await help.expectShortcuts(["Undo ticking a task off ⌘Z"])
  await help.closeWithEscape()

  await inbox.keyboard.press("c")
  const reopened = await inbox.sidebar.openShortcuts()
  await inbox.keyboard.expectCaptureNotFocused()
  await reopened.setSingleKeys(true)
  await reopened.close()
  await inbox.keyboard.addTask("Fix the tap")
  await inbox.expectTasks(["H-1 Fix the tap"])
})
