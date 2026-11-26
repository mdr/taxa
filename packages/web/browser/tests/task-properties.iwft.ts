import { test } from "../fixtures/taxa-fixture.ts"

test("scheduling a task for a time, and setting and clearing what else it needs", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await detail.scheduleFor("Tomorrow")
  await detail.expectScheduled("2026-01-06", "Tue 6 Jan")
  await detail.setScheduledTime("18:30")
  await detail.expectScheduled("2026-01-06", "Tue 6 Jan · 18:30")
  await detail.pickDue("2026-02-12")
  await detail.expectDue("2026-02-12")
  await detail.setEstimate("45m")
  await detail.expectEstimate("45m")
  await taxa.expectTask("H-1", {
    scheduled: "2026-01-06",
    scheduledTime: "18:30",
    due: "2026-02-12",
    estimateMinutes: 45
  })

  await detail.clearEstimate()
  await detail.expectEstimate("")
  await taxa.expectTask("H-1", { estimateMinutes: undefined })
})

test("copying a task's reference", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.copyRef()
  await detail.expectClipboard("H-1")
})

test("notes being written are kept when you go elsewhere, and stay with their task", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.addTask("Renew passport", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.startTypingNotes("Call the plumber")
  const list = await detail.sidebar.openDomain("Home")
  await taxa.expectTask("H-1", { notes: "Call the plumber" })

  const other = await list.openTask("Renew passport")
  await other.expectNotesText("")
})
