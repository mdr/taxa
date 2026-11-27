import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { test, type TestTaxa } from "../fixtures/taxa-fixture.ts"
import { BulkActionType } from "../../src/tasks/select/bulk-actions.ts"

const addFour = async (taxa: TestTaxa): Promise<void> => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addDomain("Work", "W")
  for (const title of ["Fix the tap", "Paint the fence", "Clear the gutters", "Mow the lawn"])
    await taxa.matt.addTask(title, { domain: "H", inbox: false })
}

test("choosing tasks and changing them all at once, then undoing that in one go", async ({ taxa }) => {
  await addFour(taxa)
  const home = await (await (await taxa.openTab("Matt")).openInbox()).sidebar.openDomain("Home")

  await home.bulk.start()
  await home.bulk.expectSelecting(true)
  await home.bulk.choose("Fix the tap")
  // Shift-click chooses the run of tasks from the last one chosen.
  await home.bulk.clickTitle("Clear the gutters", true)
  await home.bulk.expectChosen(["Fix the tap", "Paint the fence", "Clear the gutters"])
  await home.bulk.clickTitle("Paint the fence")
  await home.bulk.expectChosen(["Fix the tap", "Clear the gutters"])
  await home.expectAccessible()

  await home.bulk.pick(BulkActionType.PRIORITY, "High")
  await home.bulk.expectSelecting(false)
  await home.bulk.expectReport("2 tasks: high priority")
  await taxa.expectTask("H-1", { priority: Priority.HIGH })
  await taxa.expectTask("H-3", { priority: Priority.HIGH })
  await taxa.expectTask("H-2", { priority: Priority.NORMAL })

  await home.bulk.undo()
  await taxa.expectTask("H-1", { priority: Priority.NORMAL })
  await taxa.expectTask("H-3", { priority: Priority.NORMAL })
})

test("selecting by keyboard: Space chooses, ⌘A all, Esc stops; done and moved together", async ({ taxa }) => {
  await addFour(taxa)
  const home = await (await (await taxa.openTab("Matt")).openInbox()).sidebar.openDomain("Home")

  await home.keyboard.press("j")
  await home.keyboard.press("Space")
  await home.bulk.expectChosen(["Fix the tap"])
  await home.keyboard.press("j j Space")
  await home.bulk.expectChosen(["Fix the tap", "Clear the gutters"])
  await home.bulk.act(BulkActionType.DONE)
  await taxa.expectTask("H-1", { status: TaskStatus.DONE })
  await taxa.expectTask("H-3", { status: TaskStatus.DONE })
  await home.keyboard.press("mod+z")
  await taxa.expectTask("H-1", { status: TaskStatus.OPEN })
  await taxa.expectTask("H-3", { status: TaskStatus.OPEN })

  await home.bulk.start()
  await home.keyboard.press("mod+a")
  await home.bulk.expectChosen(["Fix the tap", "Paint the fence", "Clear the gutters", "Mow the lawn"])
  await home.keyboard.press("Escape")
  await home.bulk.expectSelecting(false)

  await home.bulk.start()
  await home.bulk.selectAll()
  await home.bulk.pick(BulkActionType.MOVE, "Work")
  await home.bulk.expectReport("Moved 4 tasks to Work")
  await home.expectTasks([])
})
