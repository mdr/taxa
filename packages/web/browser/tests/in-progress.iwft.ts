import { expect } from "@playwright/test"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("starting tasks from the keyboard puts them first, and in the In progress list", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.addTask("Bleed the radiators", { domain: "H" })
  await taxa.matt.addTask("Renew passport")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.expectInProgressCount(0)

  const home = await inbox.sidebar.openDomain("Home")
  await home.expectTasks(["H-1 Fix the tap", "H-2 Bleed the radiators"])
  await home.keyboard.press("j j")
  await home.expectHighlighted("Bleed the radiators")
  await home.keyboard.press("i")
  await home.expectTasks(["H-2 Bleed the radiators", "H-1 Fix the tap"])
  await home.sidebar.expectInProgressCount(1)

  await home.sidebar.openInbox()
  await inbox.keyboard.press("j i")
  await inbox.sidebar.expectInProgressCount(2)

  const started = await inbox.sidebar.openInProgress()
  await started.expectHeading("In progress")
  await started.expectTasks(["H-2 Bleed the radiators", "IN-3 Renew passport"])
  await started.expectAccessible()

  const detail = await started.openTask("Bleed the radiators")
  await detail.expectStatus(TaskStatus.IN_PROGRESS)
  await detail.keyboard.press("i")
  await detail.expectStatus(TaskStatus.OPEN)
  await detail.sidebar.expectInProgressCount(1)
  await expect.poll(async () => (await taxa.matt.client.task("2")).status).toBe(TaskStatus.OPEN)
})

test("an empty In progress list says how to start something", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  const started = await inbox.sidebar.openInProgress()
  await started.expectHeading("In progress")
  await started.expectTasks([])
  await started.expectAccessible()
})
