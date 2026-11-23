import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("undoing adding a task by mistake, and redoing it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const tab = await taxa.openTab("Matt")
  const inbox = await tab.openInbox()
  await inbox.capture("Fix the tap")
  await inbox.capture("Fix the tpa")
  await inbox.expectTasks(["IN-1 Fix the tap", "IN-2 Fix the tpa"])

  await inbox.keyboard.press("mod+z")
  await inbox.undoNotice.expectSays("Undid: Added IN-2")
  await inbox.expectTasks(["IN-1 Fix the tap"])
  await taxa.expectTaskCount(1)

  await inbox.undoNotice.goBack()
  await inbox.undoNotice.expectSays("Redid: Added IN-2")
  await inbox.expectTasks(["IN-1 Fix the tap", "IN-2 Fix the tpa"])
  await inbox.keyboard.press("mod+z")
  await inbox.keyboard.press("mod+Shift+z")
  await inbox.expectTasks(["IN-1 Fix the tap", "IN-2 Fix the tpa"])
})

test("undoing any change, last first, from any page", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const tab = await taxa.openTab("Matt")
  const detail = await tab.openTask("H-1")
  await detail.expectRef("H-1")
  await detail.keyboard.rename("Fix the kitchen tap")
  await detail.expectTitle("Fix the kitchen tap")
  await detail.setPriorityWithKeys(Priority.HIGH)
  await taxa.expectTask("H-1", { priority: Priority.HIGH })

  const home = await detail.keyboard.goTo("g h")
  await home.keyboard.press("mod+z")
  await home.undoNotice.expectSays("Undid: Changed H-1")
  await taxa.expectTask("H-1", { priority: Priority.NORMAL })
  await home.keyboard.press("mod+z")
  await home.undoNotice.expectSays("Undid: Renamed H-1")
  await home.expectTasks(["H-1 Fix the tap"])
})

test("saying why a change can't be undone, when it's been changed since", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap")
  const tab = await taxa.openTab("Matt")
  const inbox = await tab.openInbox()
  await inbox.keyboard.press("j")
  await inbox.keyboard.renameRow("Fix the kitchen tap")
  await inbox.expectTasks(["IN-1 Fix the kitchen tap"])
  await taxa.matt.client.updateTask("IN-1", { set: { title: "Fix the bathroom tap" } })
  await inbox.keyboard.press("mod+z")
  await inbox.undoNotice.expectSays("undo the later change first")
})

test("undoing an earlier change from a task's activity", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const tap = await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.client.updateTask(tap.ref, { set: { priority: Priority.HIGH } })
  await taxa.matt.client.updateTask(tap.ref, { set: { title: "Fix the kitchen tap" } })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.expectRef("H-1")

  await detail.undoFromActivity("set priority to high")
  await detail.undoNotice.expectSays("Undid: Changed H-1")
  await detail.expectPriority(Priority.NORMAL)
  await detail.expectTitle("Fix the kitchen tap")
  await detail.expectActivity([
    "Matt created this",
    "Matt set priority to high",
    "Matt renamed it “Fix the kitchen tap”",
    "Matt undid change 2: set priority to normal"
  ])
})

test("restoring a deleted task from the trash", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const tap = await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const bins = await taxa.matt.addTask("Put the bins out", { domain: "H" })
  await taxa.matt.client.deleteTask(bins.ref)
  await taxa.advance(60_000)
  await taxa.matt.client.deleteTask(tap.ref)
  const home = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openDomain("Home"))
  const trash = await home.sidebar.openTrash()
  await trash.expectTasks(["H-1 Fix the tap", "H-2 Put the bins out"])
  await trash.expectAccessible()

  await trash.restore("Fix the tap")
  await trash.expectTasks(["H-2 Put the bins out"])
  await taxa.expectTaskCount(1)
  await trash.restore("Put the bins out")
  await trash.expectEmpty()
  // Restoring is a change like any other.
  await trash.keyboard.press("mod+z")
  await trash.undoNotice.expectSays("Undid: Restored H-2")
  await trash.expectTasks(["H-2 Put the bins out"])
})

test("⌘Z takes back the last change, though ticking off one before it is still on offer", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap")
  await taxa.matt.addTask("Pay the bill")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.complete("Fix the tap")
  await inbox.expectUndoOffered("Fix the tap")
  await inbox.keyboard.press("j")
  await inbox.keyboard.renameRow("Pay the gas bill")

  await inbox.keyboard.press("mod+z")
  await inbox.undoNotice.expectSays("Undid: Renamed IN-2")
  await inbox.expectTasks(["✓ IN-1 Fix the tap", "IN-2 Pay the bill"])
  await taxa.expectTask("IN-1", { status: TaskStatus.DONE })
})

test("undoing on a task's page: a change to its notes, or adding it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { notes: "Washer size" })
  const tab = await taxa.openTab("Matt")
  const detail = await tab.openTask("IN-1")
  await detail.expectRef("IN-1")
  await detail.keyboard.writeNotes(" 15mm")
  await taxa.expectTask("IN-1", { notes: "Washer size 15mm" })
  await detail.keyboard.press("mod+z")
  await detail.undoNotice.expectSays("Undid: Changed IN-1")
  await detail.expectNotesText("Washer size")

  const inbox = await detail.keyboard.backToList()
  await inbox.capture("Call the plumber")
  const plumber = await inbox.openTask("Call the plumber")
  await plumber.keyboard.press("mod+z")
  await plumber.undoNotice.expectSays("Undid: Added IN-2")
  await plumber.expectDeleted()
})
