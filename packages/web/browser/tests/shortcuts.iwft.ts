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

  const work = await inbox.sidebar.openDomain("Work")
  await work.keyboard.addTask("Plan the quarter")
  await work.expectTasks(["WK-2 Plan the quarter"])

  // G shows the keys that can come next; Escape or a click elsewhere cancels it.
  const going = await work.keyboard.startGoingTo()
  await going.expectOffered(["T Today", "S Soon", "I Inbox", "P In progress", "N Session", "M Someday", "B Bin"])
  await going.expectAccessible()
  await going.cancel()
  await going.expectGone()
  await (await work.keyboard.startGoingTo()).clickAway()
  await going.expectGone()
  await (await (await work.keyboard.startGoingTo()).choose("Soon")).expectHeading("Soon")

  // G then a letter goes to each list used every day.
  await (await work.keyboard.goTo("g t")).expectHeading("Today")
  await (await work.keyboard.goTo("g s")).expectHeading("Soon")
  await (await work.keyboard.goTo("g p")).expectHeading("In progress")
  await (await work.keyboard.goTo("g m")).expectHeading("Someday")
  await (await work.keyboard.goToSession()).expectShown()
  await (await work.keyboard.goToBin()).expectShown()
  await (await work.keyboard.goTo("g i")).expectHeading("Inbox")

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
    "Undo the last change ⌘Z",
    "Redo what was undone ⌘⇧Z",
    "Today G then T",
    "Soon G then S",
    "Inbox G then I",
    "In progress G then P",
    "Session G then N",
    "Someday G then M",
    "Bin G then B",
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
    "Rename the task R",
    "Add a follow-on task F",
    "Delete the task Delete or Backspace",
    "Leave the list Esc"
  ])
  await help.expectAccessible()
  await help.setSingleKeys(false)
  await help.expectShortcuts([
    "Find a command or task ⌘K",
    "Undo the last change ⌘Z",
    "Redo what was undone ⌘⇧Z",
    "Next task ↓",
    "Previous task ↑",
    "Open the task Enter",
    "Delete the task Delete or Backspace",
    "Leave the list Esc"
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

  // Back from a task, the list is where you left it, on the same task.
  await home.keyboard.press("j")
  await home.expectHighlighted("Clear the gutters")
  const detail = await home.keyboard.openHighlighted()
  await detail.expectRef("H-3")
  const back = await detail.keyboard.backToList()
  await back.expectHeading("Home")
  await back.expectHighlighted("Clear the gutters")
  await back.keyboard.press("k")
  await back.expectHighlighted("Bleed the radiators")

  // So too for a task opened with a click.
  const clicked = await back.openTask("Fix the tap")
  await clicked.expectRef("H-1")
  await (await clicked.keyboard.backToList()).expectHighlighted("Fix the tap")
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
  // Domains have no shortcut, but are here.
  await menu.search("go h")
  await menu.expectCommands(["Home"])
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
