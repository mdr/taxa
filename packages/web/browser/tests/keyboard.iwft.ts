import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("a task's properties work from the keyboard", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await detail.openAndEscapePriority()
  await detail.expectPriorityClosedAndFocused()
  await detail.setPriorityWithKeys(Priority.LOW)
  await detail.expectPriority(Priority.LOW)
  await taxa.expectTask("H-1", { priority: Priority.LOW })
})

test("Escape abandons a rename", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.abandonRename("Something else")
  await detail.expectTitle("Fix the tap")
  await detail.expectActivity(["Matt created this"])
  await taxa.expectTask("H-1", { title: "Fix the tap" })
})

test("a task can be ticked off from the keyboard", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.sidebar.openDomain("Home")
  await list.completeWithKeyboard("Fix the tap")
  await list.expectTasks(["✓ H-1 Fix the tap"])
  await taxa.expectTask("H-1", { status: TaskStatus.DONE })
})
