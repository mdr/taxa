import { TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("taking a task through its statuses from its page", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await detail.setStatus(TaskStatus.IN_PROGRESS)
  await detail.expectStatus(TaskStatus.IN_PROGRESS)
  await detail.expectWorkingOn("Matt is working on this")
  await detail.setStatus(TaskStatus.WAITING)
  await detail.expectWaiting("Waiting, follow up Mon 12 Jan")
  await detail.setStatus(TaskStatus.DONE)
  await detail.expectStatus(TaskStatus.DONE)
  await detail.setStatus(TaskStatus.OPEN)
  await detail.expectStatus(TaskStatus.OPEN)
  await detail.setStatus(TaskStatus.CANCELLED)
  await detail.expectActivity([
    "Matt created this",
    "Matt started it",
    "Matt marked it waiting",
    "Matt marked it done",
    "Matt reopened it",
    "Matt cancelled it"
  ])
  await taxa.expectTask("H-1", { status: TaskStatus.CANCELLED })
})

test("a task waiting on someone says who, on its page and in its list", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the boiler", { domain: "H" })
  await taxa.matt.changeStatus("H-1", TaskStatus.WAITING, "the engineer")
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.expectWaiting("Waiting on the engineer, follow up Mon 12 Jan")
  const list = await detail.sidebar.openDomain("Home")
  await list.expectHighlights("Fix the boiler", "Waiting on the engineer")
})
