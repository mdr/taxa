import { expect } from "@playwright/test"
import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("editing a task's fields and notes, each change in its activity log", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.expectAccessible()

  await detail.rename("Fix the kitchen tap")
  await detail.setPriority(Priority.HIGH)
  await detail.setDue("2026-01-09")
  await detail.setEstimate("1h30m")
  await detail.writeNotes("## Plan\n\n- Turn off the water\n- Replace the washer")
  await detail.expectNotesHeading("Plan")
  await detail.expectActivity([
    "Matt created it",
    'Matt changed: title "Fix the tap" → "Fix the kitchen tap"',
    "Matt changed: priority normal → high",
    'Matt changed: due nothing → "2026-01-09"',
    "Matt changed: estimateMinutes nothing → 90",
    'Matt changed: notes "" → "## Plan\\n\\n- Turn off the water\\n- Replace…"'
  ])
  await detail.expectEstimate("1h30m")
  await detail.expectAccessible()

  await expect
    .poll(async () => taxa.matt.client.task("H-1"))
    .toMatchObject({ title: "Fix the kitchen tap", priority: Priority.HIGH, due: "2026-01-09", estimateMinutes: 90 })

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
  await detail.expectWorkingOn("Claude Code for Matt (boiler research) is working on this.")
  await detail.expectActivity([
    "Matt created it",
    "Claude Code for Matt (boiler research) changed status: status open → in progress; inProgressBy nothing → someone"
  ])
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

test("deleting a task, then restoring it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.delete()
  await expect.poll(async () => (await taxa.matt.client.tasks()).length).toBe(0)
  await detail.restore()
  await expect.poll(async () => (await taxa.matt.client.tasks()).length).toBe(1)
})
