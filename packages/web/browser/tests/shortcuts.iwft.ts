import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("adding tasks and moving between lists from the keyboard", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addDomain("Work", "WK")
  const tab = await taxa.openTab("Matt")
  const inbox = await tab.openInbox()

  // c and g in a title are typed, not taken as shortcuts.
  await inbox.keyboard.addTask("Get coffee")
  await inbox.expectTasks(["IN-1 Get coffee"])

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
  await inbox.sidebar.expectDomains(["H Home"])

  const help = await inbox.keyboard.openShortcuts()
  await help.expectShortcuts([
    "Add a task C",
    "Show keyboard shortcuts ?",
    "Find a command or task ⌘K",
    "Inbox G then I",
    "Home G then H",
    "Search the list /",
    "Next task J or ↓",
    "Previous task K or ↑",
    "Open the task Enter",
    "Tick off, or untick X",
    "Start, or stop working on it I",
    "Change status S",
    "Set priority P",
    "Choose when W",
    "Set a due date D",
    "Estimate E",
    "Move to a domain M",
    "Add a tag L",
    "Open the task's menu .",
    "Add a follow-on task F",
    "Delete the task Delete or Backspace",
    "Leave the list Esc",
    "Undo ticking off or deleting a task ⌘Z"
  ])
  await help.expectAccessible()
  await help.setSingleKeys(false)
  await help.expectShortcuts([
    "Find a command or task ⌘K",
    "Next task ↓",
    "Previous task ↑",
    "Open the task Enter",
    "Delete the task Delete or Backspace",
    "Leave the list Esc",
    "Undo ticking off or deleting a task ⌘Z"
  ])
  await help.closeWithEscape()

  await inbox.keyboard.press("c")
  const reopened = await inbox.sidebar.openShortcuts()
  await inbox.keyboard.expectCaptureNotFocused()
  await reopened.setSingleKeys(true)
  await reopened.close()
  await inbox.keyboard.addTask("Fix the tap")
  await inbox.expectTasks(["IN-1 Fix the tap"])
})

test("moving through a list, and ticking off and opening tasks, from the keyboard", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  for (const title of ["Fix the tap", "Bleed the radiators", "Clear the gutters"]) {
    await taxa.matt.addTask(title, { domain: "H" })
  }
  const home = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openDomain("Home"))
  await home.expectTasks(["H-1 Fix the tap", "H-2 Bleed the radiators", "H-3 Clear the gutters"])

  await home.keyboard.press("j")
  await home.expectHighlighted("Fix the tap")
  await home.keyboard.press("ArrowDown")
  await home.expectHighlighted("Bleed the radiators")
  await home.keyboard.press("x")
  await home.expectTasks(["H-1 Fix the tap", "✓ H-2 Bleed the radiators", "H-3 Clear the gutters"])
  await home.expectUndoOffered("Bleed the radiators")
  await home.keyboard.press("mod+z")
  await home.expectTasks(["H-1 Fix the tap", "H-2 Bleed the radiators", "H-3 Clear the gutters"])

  await home.keyboard.press("k")
  await home.expectHighlighted("Fix the tap")
  const detail = await home.keyboard.openHighlighted()
  await detail.expectRef("H-1")
  const back = await detail.keyboard.backToList()
  await back.expectHeading("Home")
})

test("changing a task from the keyboard on its page", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addDomain("Work", "W")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.expectRef("H-1")

  await detail.keyboard.choose("p", Priority.HIGH)
  await detail.expectPriority(Priority.HIGH)
  await detail.keyboard.choose("s", TaskStatus.IN_PROGRESS)
  await detail.expectStatus(TaskStatus.IN_PROGRESS)
  await detail.keyboard.typeDate("d", "2026-03-02")
  await detail.expectDue("2026-03-02")
  await detail.keyboard.rename("Fix the kitchen tap")
  await detail.expectTitle("Fix the kitchen tap")
  await detail.keyboard.writeNotes("Washers")
  await detail.expectNotesText("Washers")
  await detail.keyboard.choose("m", "W")
  await detail.expectRef("W-1")
  await taxa.expectTask("W-1", {
    priority: Priority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    due: "2026-03-02",
    title: "Fix the kitchen tap",
    notes: "Washers"
  })

  const work = await detail.keyboard.backToList()
  await work.expectHeading("Work")
  await work.expectTasks(["W-1 Fix the kitchen tap"])
})

test("finding and running commands from the command menu", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.expectDomains(["H Home"])

  const menu = await inbox.keyboard.openCommandMenu()
  await menu.expectAccessible()
  await menu.search("go")
  await menu.expectCommands(["Inbox", "Home"])
  await menu.pickNext()
  await menu.expectPicked("Home")
  await menu.run()
  await inbox.expectHeading("Home")

  const detail = await (await inbox.keyboard.openCommandMenu()).openTask("H-1")
  await detail.expectRef("H-1")

  const changing = await detail.keyboard.openCommandMenu()
  await changing.search("prio")
  await changing.expectCommands(["Set priority"])
  await changing.run()
  await detail.keyboard.chooseInOpenPicker(Priority.URGENT)
  await detail.expectPriority(Priority.URGENT)
  await taxa.expectTask("H-1", { priority: Priority.URGENT })
})
