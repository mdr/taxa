import { expect } from "@playwright/test"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("capturing to the Inbox and filing a task", async ({ taxa }) => {
  const inbox = await (await (await taxa.openTab("Matt")).openFirstTime()).start()
  await inbox.sidebar.addDomain("Hobbies", "H")
  await inbox.sidebar.expectDomainProblem("H")

  await inbox.capture("Fix the tap")
  await inbox.capture("Renew passport")
  await inbox.expectTasks(["P-1 Fix the tap", "P-2 Renew passport"])
  await inbox.expectAccessible()

  const detail = await inbox.openTask("Fix the tap")
  await detail.moveTo("H")
  await detail.expectRef("H-1")
  await detail.sidebar.openInbox()
  await inbox.expectTasks(["P-2 Renew passport"])
  await inbox.sidebar.openDomain("Home")
  await inbox.expectHeading("Home")
  await inbox.expectTasks(["H-1 Fix the tap"])
})

test("a new domain's prefix is suggested from its name", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.addDomainSuggested("Hobbies")
  await inbox.sidebar.expectDomains(["H Home", "HO Hobbies"])
})

test("a task captured in a domain's list goes straight into it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.openDomain("Home")
  await inbox.capture("Bleed the radiators")
  await inbox.expectTasks(["H-1 Bleed the radiators"])
  expect((await taxa.matt.client.task("H-1")).inbox).toBe(false)
})

test("ticking a task off finishes it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H", due: "2026-01-09" })
  await taxa.matt.addTask("Renew passport", { domain: "H" })
  const list = await (await taxa.openTab("Matt")).openInbox()
  await list.sidebar.openDomain("Home")
  await list.expectHighlights("Fix the tap", "due Fri 9 Jan")
  await list.complete("Fix the tap")
  await list.expectTasks(["H-2 Renew passport"])
  await expect.poll(async () => (await taxa.matt.client.task("H-1")).status).toBe(TaskStatus.DONE)
})
