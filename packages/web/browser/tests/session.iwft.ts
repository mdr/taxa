import { TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

const MINUTE = 60_000

test("planning a session, working through it, running over, and how it went", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Bleed the radiators", { domain: "H", estimateMinutes: 30 })
  await taxa.matt.addTask("Research boilers", { domain: "H", estimateMinutes: 120 })
  const passport = await taxa.matt.addTask("Renew passport")
  await taxa.matt.addTask("Fix the tap")
  const tab = await taxa.openTab("Matt")
  const inbox = await tab.openInbox()

  const setup = await inbox.sidebar.openSession()
  await setup.chooseLength("2 hours")
  await setup.expectWindow("9:00 – 11:00 am")
  await setup.expectAccessible()
  let planner = await setup.chooseTasks()
  await planner.plan.expectSuggestions(["Bleed the radiators", "Research boilers", "Renew passport", "Fix the tap"])

  // An estimate given to a suggestion is the task's own.
  await planner.plan.estimateSuggestion("Renew passport", "20m")
  await planner.plan.expectSuggestionEstimate("Renew passport", "20m")
  await taxa.expectTask(passport.ref, { estimateMinutes: 20 })

  // Dragged in: onto the plan, last; onto a task, before or after it by where it's let go.
  await planner.plan.dragInLast("Renew passport")
  await planner.plan.expectPlan(["9:00 – 9:20 Renew passport"])
  await planner.plan.dragIn("Bleed the radiators", "Renew passport", "before")
  await planner.plan.dragIn("Research boilers", "Bleed the radiators", "after")
  await planner.plan.expectPlan([
    "9:00 – 9:30 Bleed the radiators",
    "9:30 – 11:30 Research boilers",
    "11:30 – 11:50 Renew passport"
  ])
  // Let go back over the suggestions, a task stays there, and the plan's as it was.
  await planner.plan.dragAndLetGo("Fix the tap")
  await planner.plan.expectSuggestions(["Fix the tap"])
  await planner.plan.expectPlanUnchanged([
    "9:00 – 9:30 Bleed the radiators",
    "9:30 – 11:30 Research boilers",
    "11:30 – 11:50 Renew passport"
  ])

  // A planned task's estimate is the task's own too, and the plan follows it.
  await planner.plan.estimatePlanned("Research boilers", "45m")
  await planner.plan.expectPlan([
    "9:00 – 9:30 Bleed the radiators",
    "9:30 – 10:15 Research boilers",
    "10:15 – 10:35 Renew passport"
  ])
  await taxa.expectTask("H-2", { estimateMinutes: 45 })

  // A look at a task, and back: the plan's as it was.
  const boilers = await planner.plan.openPlanned("Research boilers")
  await boilers.expectEstimate("45m")
  planner = await boilers.sidebar.openSessionPlan()
  await planner.plan.expectPlan([
    "9:00 – 9:30 Bleed the radiators",
    "9:30 – 10:15 Research boilers",
    "10:15 – 10:35 Renew passport"
  ])
  await planner.expectCapacity("1 h 35 min planned of 2 h", "25 min spare")
  await planner.expectAccessible()

  const session = await planner.start()
  await session.expectCurrent("Bleed the radiators", "30:00")
  await session.expectStatus("9:00 – 11:00 am · 2 h left · 25 min spare")
  await session.sidebar.expectSessionLeft("30m")
  await taxa.expectTask("H-1", { status: TaskStatus.IN_PROGRESS })
  await session.expectAccessible()

  await taxa.advance(27 * MINUTE)
  await session.expectCurrent("Bleed the radiators", "3:00")
  await session.keyboard.press("x")
  await session.expectCurrent("Research boilers", "45:00")
  await session.expectTimeline([
    ["9:00 – 9:27", "Bleed the radiators", "27 min of 30 min"],
    ["9:27 – 10:12", "Research boilers", "now"],
    ["10:12 – 10:32", "Renew passport", "20 min"]
  ])
  await taxa.expectTask("H-1", { status: TaskStatus.DONE })

  await taxa.advance(60 * MINUTE)
  await session.expectCurrent("Research boilers", "15 min over")
  await session.sidebar.expectSessionLeft("+15m")
  await session.expectStatus("9:00 – 11:00 am · 33 min left · 13 min spare")
  await session.expectTimeline([
    ["9:00 – 9:27", "Bleed the radiators", "27 min of 30 min"],
    ["9:27 – 10:27", "Research boilers", "1 h so far"],
    ["10:27 – 10:47", "Renew passport", "20 min"]
  ])
  await session.expectAccessible()
  await session.moreTime()
  await session.expectCurrent("Research boilers", "0:00")
  await session.keyboard.press("i")
  await session.expectCurrent("Renew passport", "20:00")
  await taxa.expectTask("H-2", { status: TaskStatus.OPEN })

  const summary = await session.end()
  await summary.expectCounts(["1finished", "1worked on, not finished", "1didn't get to", "1 h 27 minspent on tasks"])
  await summary.expectTasks([
    ["Bleed the radiators", "30 min", "27 min", "Done"],
    ["Research boilers", "1 h", "1 h", "Open, in Home"],
    ["Renew passport", "20 min", "–", "Open, in the Inbox"]
  ])
  await summary.sidebar.expectNoSessionLeft()
  await summary.expectAccessible()
  await summary.writeNote("Quotes from two installers next")
  await taxa.expectSessionNote(summary.sessionId(), "Quotes from two installers next")
  await summary.finish()
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
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { estimateMinutes: 15 })
  await taxa.matt.addTask("Bleed the radiators")
  await taxa.matt.addTask("Renew passport")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  const setup = await inbox.sidebar.openSession()
  await setup.chooseUntil("08:30")
  await setup.expectWindow("That time's passed today.")
  await setup.chooseTasksExpectingProblem("That time's passed today: choose a later one.")
  await setup.chooseUntil("10:00")
  await setup.expectWindow("9:00 – 10:00 am")
  const planner = await setup.chooseTasks()

  // Moved with the keyboard, and dragged back out.
  await planner.plan.add("Fix the tap")
  await planner.plan.add("Bleed the radiators")
  await planner.plan.expectPlan(["9:00 – 9:15 Fix the tap", "9:15 – 9:45 Bleed the radiators"])
  await planner.plan.moveUpByKeyboard("Bleed the radiators")
  await planner.plan.expectPlan(["9:00 – 9:30 Bleed the radiators", "9:30 – 9:45 Fix the tap"])
  await planner.plan.dragOut("Bleed the radiators")
  await planner.plan.expectPlan(["9:00 – 9:15 Fix the tap"])
  const session = await planner.start()
  await session.expectCurrent("Fix the tap", "15:00")

  await session.replan()
  await session.plan.add("Bleed the radiators")
  await session.plan.expectPlan(["9:00 – 9:15 Fix the tap", "9:15 – 9:45 Bleed the radiators"])
  await session.plan.estimatePlanned("Bleed the radiators", "45m")
  await session.plan.expectPlan(["9:00 – 9:15 Fix the tap", "9:15 – 10:00 Bleed the radiators"])
  await taxa.expectTask("H-2", { estimateMinutes: 45 })

  // Put ahead of the task under way, a task's started now, the other waiting next.
  await session.plan.dragIn("Renew passport", "Fix the tap", "before")
  await session.expectCurrent("Renew passport", "30:00")
  await session.plan.expectPlan([
    "9:00 – 9:30 Renew passport",
    "9:30 – 9:45 Fix the tap",
    "9:45 – 10:30 Bleed the radiators"
  ])
  await taxa.expectTask("H-1", { status: TaskStatus.OPEN })
  await session.expectAccessible()
  await session.plan.remove("Bleed the radiators")
  await session.doneReplanning()

  // Done by mistake: undone, the task's under way again and back in progress.
  await session.keyboard.press("x")
  await session.expectCurrent("Fix the tap", "15:00")
  await session.expectUndoOffered("“Renew passport” done")
  await taxa.expectTask("H-3", { status: TaskStatus.DONE })
  await session.expectAccessible()
  await session.undo()
  await session.expectCurrent("Renew passport", "30:00")
  await session.expectNoUndoOffered()
  await taxa.expectTask("H-3", { status: TaskStatus.IN_PROGRESS })
  await session.done()
  await session.expectCurrent("Fix the tap", "15:00")
  await session.done()
  await session.expectStatus("9:00 – 10:00 am · 1 h left · 1 h spare")
  await session.expectTimeline([
    ["9:00 – 9:00", "Renew passport", "0 min of 30 min"],
    ["9:00 – 9:00", "Fix the tap", "0 min of 15 min"]
  ])
})

test("planning a session: suggestions narrowed to a tag, and a task thought of while planning", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Buy washers", { domain: "H", tags: ["errand"] })
  await taxa.matt.addTask("Bleed the radiators", { domain: "H" })
  await taxa.matt.addTask("Post the letter", { tags: ["Errand", "admin"] })
  const tab = await taxa.openTab("Matt")
  const setup = await (await tab.openInbox()).sidebar.openSession()
  await setup.chooseLength("1 hour")
  const planner = await setup.chooseTasks()
  await planner.plan.expectSuggestions(["Buy washers", "Bleed the radiators", "Post the letter"])

  await planner.plan.filterByTag("errand")
  await planner.plan.expectSuggestions(["Buy washers", "Post the letter"])
  await planner.expectAccessible()
  await planner.plan.add("Post the letter")
  await planner.plan.expectSuggestions(["Buy washers"])
  await planner.plan.filterByTag(undefined)
  await planner.plan.expectSuggestions(["Buy washers", "Bleed the radiators"])

  await planner.plan.addNewTask("Call the plumber")
  await planner.plan.expectPlan(["9:00 – 9:30 Post the letter", "9:30 – 10:00 Call the plumber"])
  // Planned as it's added, it's sorted out already, not left in the Inbox.
  await taxa.expectTask("H-4", { title: "Call the plumber", inbox: false })
  await planner.expectAccessible()
})

test("a task added to a session's plan by mistake, undone, comes out of the plan", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap")
  const setup = await (await (await taxa.openTab("Matt")).openInbox()).sidebar.openSession()
  await setup.chooseLength("1 hour")
  const planner = await setup.chooseTasks()
  await planner.plan.add("Fix the tap")
  await planner.plan.addNewTask("Call the plumber")
  await planner.plan.expectPlan(["9:00 – 9:30 Fix the tap", "9:30 – 10:00 Call the plumber"])

  await planner.keyboard.press("Escape mod+z")
  await planner.undoNotice.expectSays("Undid: Added H-2")
  await planner.plan.expectPlan(["9:00 – 9:30 Fix the tap"])
  const session = await planner.start()
  await session.expectCurrent("Fix the tap", "30:00")
})

test("⌘Z in a session takes back moving on; a task under way that's undone away leaves it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap")
  const setup = await (await (await taxa.openTab("Matt")).openInbox()).sidebar.openSession()
  await setup.chooseLength("1 hour")
  const planner = await setup.chooseTasks()
  await planner.plan.addNewTask("Call the plumber")
  await planner.plan.add("Fix the tap")
  const session = await planner.start()
  await session.expectCurrent("Call the plumber", "30:00")

  await session.keyboard.press("x")
  await session.expectCurrent("Fix the tap", "30:00")
  await session.keyboard.press("mod+z")
  await session.expectCurrent("Call the plumber", "30:00")
  await taxa.expectTask("H-2", { status: TaskStatus.IN_PROGRESS })

  // Nothing left to take back in the session, so the tab's last change: adding the task under way.
  await session.keyboard.press("mod+z")
  await session.undoNotice.expectSays("Undid: Added H-2")
  await taxa.expectTaskCount(1)
  await session.startNext()
  await session.expectCurrent("Fix the tap", "30:00")
  await session.replan()
  await session.plan.expectPlan(["9:00 – 9:30 Fix the tap"])
})
