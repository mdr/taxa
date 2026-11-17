import { expect } from "@playwright/test"
import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("editing a task's properties and notes, each change in its activity log", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.expectAccessible()
  await detail.expectAccessibleWithDatePicker()

  await detail.rename("Fix the kitchen tap")
  await detail.setPriority(Priority.HIGH)
  await detail.setDue("fri")
  await detail.expectDue("2026-01-09")
  await detail.setEstimate("1h30m")
  await detail.typeNotes("## Plan\n- Turn off the water\nReplace the washer")
  await detail.expectNotesHeading("Plan")
  await detail.expectActivity([
    "Matt created this",
    "Matt renamed it “Fix the kitchen tap”",
    "Matt set priority to high",
    "Matt set due to Fri 9 Jan",
    "Matt estimated it at 1h30m",
    "Matt added notes"
  ])
  await detail.expectEstimate("1h30m")
  await detail.expectAccessible()

  await expect
    .poll(async () => taxa.matt.client.task("H-1"))
    .toMatchObject({
      title: "Fix the kitchen tap",
      priority: Priority.HIGH,
      due: "2026-01-09",
      estimateMinutes: 90,
      notes: "## Plan\n\n- Turn off the water\n- Replace the washer"
    })

  await detail.pickDue("2026-01-14")
  await detail.expectDue("2026-01-14")
  await detail.setDue("")
  await detail.expectDue("")
  await expect.poll(async () => (await taxa.matt.client.task("H-1")).due).toBeUndefined()
})

test("an agent's work shows under its own name", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Research boiler engineers", { domain: "H" })
  const claude = await taxa.matt.agent("Claude Code", "boiler research")
  await claude.client.changeStatus("H-1", { status: TaskStatus.IN_PROGRESS })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.expectWorkingOn("Claude Code for Matt (boiler research) is working on this")
  await detail.expectActivity(["Matt created this", "Claude Code for Matt (boiler research) started it"])
})

test("a change based on an old version is refused, and the latest shown", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.expectPriority(Priority.NORMAL)

  const claude = await taxa.matt.agent("Claude Code")
  await claude.client.updateTask("H-1", { set: { priority: Priority.URGENT } })
  await detail.setPriority(Priority.LOW)
  await detail.expectConflictNotice()
  await detail.expectPriority(Priority.URGENT)
  expect((await taxa.matt.client.task("H-1")).priority).toBe(Priority.URGENT)
})

test("deleting a task from its menu, then restoring it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.delete()
  await expect.poll(async () => (await taxa.matt.client.tasks()).length).toBe(0)
  await detail.restore()
  await expect.poll(async () => (await taxa.matt.client.tasks()).length).toBe(1)
})
