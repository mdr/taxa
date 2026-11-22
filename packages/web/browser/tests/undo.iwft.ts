import { Priority } from "@taxa/shared/tasks/task"
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
