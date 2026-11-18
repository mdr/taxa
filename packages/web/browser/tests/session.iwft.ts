import { expect } from "@playwright/test"
import { sessionId } from "@taxa/shared/ids"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

const MINUTE = 60_000

test("planning a session, working through it, running over, and how it went", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Bleed the radiators", { domain: "H", estimateMinutes: 30 })
  const boilers = await taxa.matt.addTask("Research boilers", { domain: "H", estimateMinutes: 120 })
  const passport = await taxa.matt.addTask("Renew passport")
  await taxa.matt.addTask("Fix the tap")
  const tab = await taxa.openTab("Matt")
  const inbox = await tab.openInbox()

  let session = await inbox.sidebar.openSession()
  await session.expectHeading("Plan a session")
  await session.chooseLength("2 hours")
  await session.expectWindow("9:00 – 11:00 am")
  await session.expectAccessible()
  await session.chooseTasks()
  await session.expectSuggestions(["Bleed the radiators", "Research boilers", "Renew passport", "Fix the tap"])

  // An estimate given to a suggestion is the task's own.
  await session.estimateSuggestion("Renew passport", "20m")
  await session.expectSuggestionEstimate("Renew passport", "20m")
  await expect.poll(async () => (await taxa.matt.client.task(passport.ref)).estimateMinutes).toBe(20)

  // Dragged in: onto the plan, last; onto a task, before or after it by where it's let go.
  await session.dragInLast("Renew passport")
  await session.expectPlan(["9:00 – 9:20 Renew passport"])
  await session.dragIn("Bleed the radiators", "Renew passport", "before")
  await session.dragIn("Research boilers", "Bleed the radiators", "after")
  await session.expectPlan([
    "9:00 – 9:30 Bleed the radiators",
    "9:30 – 11:30 Research boilers",
    "11:30 – 11:50 Renew passport"
  ])
  // Let go back over the suggestions: nothing changes.
  await session.dragAndLetGo("Fix the tap")
  await session.expectSuggestions(["Fix the tap"])
  await session.expectPlan([
    "9:00 – 9:30 Bleed the radiators",
    "9:30 – 11:30 Research boilers",
    "11:30 – 11:50 Renew passport"
  ])

  // A planned task's estimate is the task's own too, and the plan follows it.
  await session.estimatePlanned("Research boilers", "45m")
  await session.expectPlan([
    "9:00 – 9:30 Bleed the radiators",
    "9:30 – 10:15 Research boilers",
    "10:15 – 10:35 Renew passport"
  ])
  await expect.poll(async () => (await taxa.matt.client.task(boilers.ref)).estimateMinutes).toBe(45)

  // A look at a task, and back: the plan's as it was.
  const detail = await session.openPlanned("Research boilers")
  await detail.expectTitle("Research boilers")
  await detail.expectEstimate("45m")
  session = await detail.sidebar.openSession()
  await session.expectPlan([
    "9:00 – 9:30 Bleed the radiators",
    "9:30 – 10:15 Research boilers",
    "10:15 – 10:35 Renew passport"
  ])
  await session.expectCapacity("1 h 35 min planned of 2 h", "25 min spare")
  await session.expectAccessible()

  await session.start()
  await session.expectCurrent("Bleed the radiators", "30:00")
  await session.expectStatus("9:00 – 11:00 am · 2 h left · 25 min spare")
  await session.sidebar.expectSessionLeft("30m")
  expect((await taxa.matt.client.task("H-1")).status).toBe(TaskStatus.IN_PROGRESS)
  await session.expectAccessible()

  await taxa.advance(27 * MINUTE)
  await session.expectCurrent("Bleed the radiators", "3:00")
  await session.keyboard.press("x")
  await session.expectCurrent("Research boilers", "45:00")
  await session.expectSlots([
    "9:00 – 9:27Bleed the radiators27 min of 30 min",
    "9:27 – 10:12Research boilersnow",
    "10:12 – 10:32Renew passport20 min"
  ])
  expect((await taxa.matt.client.task("H-1")).status).toBe(TaskStatus.DONE)

  await taxa.advance(60 * MINUTE)
  await session.expectCurrent("Research boilers", "15 min over")
  await session.sidebar.expectSessionLeft("+15m")
  await session.expectStatus("9:00 – 11:00 am · 33 min left · 13 min spare")
  await session.expectSlots([
    "9:00 – 9:27Bleed the radiators27 min of 30 min",
    "9:27 – 10:27Research boilers1 h so far",
    "10:27 – 10:47Renew passport20 min"
  ])
  await session.expectAccessible()
  await session.moreTime()
  await session.expectCurrent("Research boilers", "0:00")
  await session.keyboard.press("i")
  await session.expectCurrent("Renew passport", "20:00")
  expect((await taxa.matt.client.task("H-2")).status).toBe(TaskStatus.OPEN)

  await session.end()
  await session.expectCounts(["1finished", "1worked on, not finished", "1didn't get to", "1 h 27 minspent on tasks"])
  await session.expectSummary([
    ["Bleed the radiators", "30 min", "27 min", "Done"],
    ["Research boilers", "1 h", "1 h", "Open, in Home"],
    ["Renew passport", "20 min", "–", "Open, in the Inbox"]
  ])
  await session.sidebar.expectSessionLeft(undefined)
  await session.expectAccessible()
  await session.writeNote("Quotes from two installers next")
  const id = sessionId(session.sessionId())
  await expect.poll(async () => (await taxa.matt.client.session(id)).note).toBe("Quotes from two installers next")
  await session.finish()
  await inbox.expectHeading("Inbox")
  await tab.expectLogged([
    "session.started",
    "session.taskFinished",
    "session.timeAdded",
    "session.taskFinished",
    "session.ended",
    "session.noteSaved"
  ])
})

test("a session's end has to be still to come, its plan can change as it goes, and finishing can be undone", async ({
  taxa
}) => {
  const tap = await taxa.matt.addTask("Fix the tap", { estimateMinutes: 15 })
  const radiators = await taxa.matt.addTask("Bleed the radiators")
  const passport = await taxa.matt.addTask("Renew passport")
  await taxa.matt.addDomain("Home", "H")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  const session = await inbox.sidebar.openSession()
  await session.chooseUntil("08:30")
  await session.expectWindow("That time's passed today.")
  await session.chooseTasks()
  await session.expectProblem("That time's passed today: choose a later one.")
  await session.chooseUntil("10:00")
  await session.expectWindow("9:00 – 10:00 am")
  await session.chooseTasks()

  // Moved with the keyboard, and dragged back out.
  await session.add("Fix the tap")
  await session.add("Bleed the radiators")
  await session.expectPlan(["9:00 – 9:15 Fix the tap", "9:15 – 9:45 Bleed the radiators"])
  await session.moveByKeyboard("Bleed the radiators", -1)
  await session.expectPlan(["9:00 – 9:30 Bleed the radiators", "9:30 – 9:45 Fix the tap"])
  await session.dragOut("Bleed the radiators")
  await session.expectPlan(["9:00 – 9:15 Fix the tap"])
  await session.start()
  await session.expectCurrent("Fix the tap", "15:00")

  await session.replan()
  await session.add("Bleed the radiators")
  await session.expectPlan(["9:00 – 9:15 Fix the tap", "9:15 – 9:45 Bleed the radiators"])
  await session.estimatePlanned("Bleed the radiators", "45m")
  await session.expectPlan(["9:00 – 9:15 Fix the tap", "9:15 – 10:00 Bleed the radiators"])
  await expect.poll(async () => (await taxa.matt.client.task(radiators.ref)).estimateMinutes).toBe(45)

  // Put ahead of the task under way, a task's started now, the other waiting next.
  await session.dragIn("Renew passport", "Fix the tap", "before")
  await session.expectCurrent("Renew passport", "30:00")
  await session.expectPlan([
    "9:00 – 9:30 Renew passport",
    "9:30 – 9:45 Fix the tap",
    "9:45 – 10:30 Bleed the radiators"
  ])
  await expect.poll(async () => (await taxa.matt.client.task(tap.ref)).status).toBe(TaskStatus.OPEN)
  await session.expectAccessible()
  await session.remove("Bleed the radiators")
  await session.replan()

  // Done by mistake: undone, the task's under way again and back in progress.
  await session.keyboard.press("x")
  await session.expectCurrent("Fix the tap", "15:00")
  await session.expectUndoBar("“Renew passport” done")
  await expect.poll(async () => (await taxa.matt.client.task(passport.ref)).status).toBe(TaskStatus.DONE)
  await session.expectAccessible()
  await session.undo()
  await session.expectCurrent("Renew passport", "30:00")
  await session.expectUndoBar(undefined)
  await expect.poll(async () => (await taxa.matt.client.task(passport.ref)).status).toBe(TaskStatus.IN_PROGRESS)
  await session.keyboard.press("x")
  await session.expectCurrent("Fix the tap", "15:00")
  await session.keyboard.press("x")
  await session.expectStatus("9:00 – 10:00 am · 1 h left · 1 h spare")
  await session.expectSlots(["9:00 – 9:00Renew passport0 min of 30 min", "9:00 – 9:00Fix the tap0 min of 15 min"])
})
