import { RepeatFrom, RepeatUnit } from "@taxa/shared/tasks/repeat"
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

test("undoing marking a task done puts back what it was waiting on", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const tap = await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.client.changeStatus(tap.ref, { status: TaskStatus.WAITING, waitingOn: "the plumber" })
  const home = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openDomain("Home"))
  const detail = await home.openTask("Fix the tap")
  await detail.setStatus(TaskStatus.DONE)
  await detail.toast.undo()
  await detail.expectStatus(TaskStatus.WAITING)
  await taxa.expectTask("H-1", { status: TaskStatus.WAITING, waitingOn: "the plumber", followUp: "2026-01-12" })
})

test("marking a task done from its page with the Done button, or X, and taking it back", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.addTask("Water the plants", {
    domain: "H",
    scheduled: "2026-01-05",
    repeat: { every: 1, unit: RepeatUnit.DAY, from: RepeatFrom.SCHEDULE }
  })
  const tab = await taxa.openTab("Matt")
  const detail = await tab.openTask("H-1")
  await detail.expectDoneButton("Mark done")
  await detail.markDone()
  await detail.expectDoneButton("Done")
  await detail.expectStatus(TaskStatus.DONE)
  await detail.toast.expectOffered("Fix the tap")
  await detail.expectAccessible()
  await taxa.expectTask("H-1", { status: TaskStatus.DONE })
  // Once done, the button doesn't take it back with a click: it opens a menu saying what it would do.
  await detail.changeFromDone("Reopen")
  await detail.expectDoneButton("Mark done")
  await taxa.expectTask("H-1", { status: TaskStatus.OPEN })
  await detail.keyboard.press("x")
  await taxa.expectTask("H-1", { status: TaskStatus.DONE })
  await detail.changeFromDone("In progress")
  await detail.expectStatus(TaskStatus.IN_PROGRESS)
  await taxa.expectTask("H-1", { status: TaskStatus.IN_PROGRESS })

  const plants = await tab.openTask("H-2")
  await plants.expectDoneButton("Done this time")
  await plants.markDone()
  await taxa.expectTask("H-2", { status: TaskStatus.OPEN, scheduled: "2026-01-06" })
  await plants.changeFromDone("Not done this time")
  await plants.expectDoneButton("Done this time")
  await taxa.expectTask("H-2", { status: TaskStatus.OPEN, scheduled: "2026-01-05" })
})
