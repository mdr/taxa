import { RepeatFrom, RepeatUnit } from "@taxa/shared/tasks/repeat"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

const DAILY = { every: 1, unit: RepeatUnit.DAY, from: RepeatFrom.SCHEDULE }

// The clock starts on Monday 5 January 2026.
test("ticking off a repeating task does it today and moves it on; unticking takes that back", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Revise Anki cards", { domain: "H", repeat: DAILY })
  await taxa.matt.addTask("Fix the tap", { domain: "H", scheduled: "2026-01-05" })
  const today = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openList("Today"))
  await today.expectHighlights("Revise Anki cards", "Every day")

  await today.complete("Revise Anki cards")
  await today.expectUndoOffered("Revise Anki cards · next tomorrow")
  await today.expectTasks(["✓ H-1 Revise Anki cards", "H-2 Fix the tap"])
  await taxa.expectTask("H-1", { status: TaskStatus.OPEN, scheduled: "2026-01-06" })
  await taxa.expectOccurrences("H-1", ["2026-01-05 DONE"])

  await today.reopen("Revise Anki cards")
  await taxa.expectTask("H-1", { status: TaskStatus.OPEN, scheduled: "2026-01-05" })
  await taxa.expectOccurrences("H-1", [])
  await today.expectTasks(["H-1 Revise Anki cards", "H-2 Fix the tap"])
})

test("a task made to repeat from its page, done and skipped there, with its history", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Revise Anki cards", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await detail.setRepeat("Every day")
  await detail.expectRepeat("Every day")
  await detail.expectHistory(["Mon 5 Jan: next"], "Nothing done yet · next today")
  await detail.setStatus(TaskStatus.DONE)
  await detail.expectHistory(["Mon 5 Jan: done", "Tue 6 Jan: next"], "1 of the last 1 done · next tomorrow")
  await detail.skipThisTime()
  await detail.expectHistory(
    ["Mon 5 Jan: done", "Tue 6 Jan: skipped", "Wed 7 Jan: next"],
    "1 of the last 2 done · next Wed 7 Jan"
  )
  await detail.keyboard.press("mod+z")
  await detail.expectHistory(["Mon 5 Jan: done", "Tue 6 Jan: next"], "1 of the last 1 done")
  await taxa.expectTask("H-1", { scheduled: "2026-01-06" })

  await detail.typeRepeat("every monday and thursday")
  await detail.expectRepeat("Every Monday and Thursday")
  await detail.expectActivity([
    "Matt created this",
    "Matt set it to repeat every day and set scheduled to Mon 5 Jan",
    "Matt did Mon 5 Jan, and moved it to Tue 6 Jan",
    "Matt skipped Tue 6 Jan, and moved it to Wed 7 Jan",
    "Matt undid change 4: put it back to Tue 6 Jan",
    "Matt set it to repeat every Monday and Thursday"
  ])
  await detail.expectAccessible()
})

test("taking a repeating task out of today's plan skips it this time", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Revise Anki cards", { domain: "H", repeat: DAILY })
  await taxa.matt.addTask("Fix the tap", { domain: "H", scheduled: "2026-01-05" })
  const today = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openList("Today"))
  const planning = await today.planToday()
  await planning.plan.expectPlan(["1 Revise Anki cards", "2 Fix the tap"])
  await planning.plan.remove("Revise Anki cards")
  await planning.plan.expectPlan(["1 Fix the tap"])
  await taxa.expectTask("H-1", { scheduled: "2026-01-06" })
  await taxa.expectOccurrences("H-1", ["2026-01-05 SKIPPED"])
})
