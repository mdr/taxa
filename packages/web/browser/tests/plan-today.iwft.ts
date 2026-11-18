import { Horizon, Priority } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("planning today: choosing what to do from suggestions, in the order you'll do it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addDomain("Work", "W")
  await taxa.matt.addTask("Fix the tap", { domain: "H", scheduled: "2026-01-05", estimateMinutes: 45 })
  await taxa.matt.addTask("Send the quote", { domain: "W", scheduled: "2026-01-02", estimateMinutes: 30 })
  await taxa.matt.addTask("Pay the bill", { domain: "H", due: "2026-01-04" })
  await taxa.matt.addTask("Research boilers", { domain: "H", horizon: Horizon.SOON })
  await taxa.matt.addTask("Back up the disks", { domain: "H", priority: Priority.HIGH })
  await taxa.matt.addTask("Whenever", { domain: "H" })
  const tab = await taxa.openTab("Matt")
  let today = await (await tab.openInbox()).sidebar.openList("Today")

  const planning = await today.planToday()
  await planning.plan.expectPlan(["1 Fix the tap", "2 Send the quote"])
  await planning.expectEstimated("2 tasks · about 1 h 15 min estimated")
  await planning.plan.expectSuggestions(["Pay the bill", "Research boilers", "Back up the disks"])
  await planning.expectAccessible()

  // Put in, a task is planned for today; taken out, it's left for soon.
  await planning.plan.add("Research boilers")
  await planning.plan.dragIn("Pay the bill", "Fix the tap", "before")
  await planning.plan.expectPlan(["1 Pay the bill", "2 Fix the tap", "3 Send the quote", "4 Research boilers"])
  await taxa.expectTask("H-3", { scheduled: "2026-01-05" })
  await taxa.expectTask("H-4", { scheduled: "2026-01-05", horizon: undefined })
  await planning.plan.remove("Send the quote")
  await taxa.expectTask("W-2", { scheduled: undefined, horizon: Horizon.SOON })
  await planning.plan.moveUpByKeyboard("Research boilers")
  await planning.plan.expectPlan(["1 Pay the bill", "2 Research boilers", "3 Fix the tap"])
  await planning.expectEstimated("3 tasks · about 45 min estimated · 2 without an estimate")

  // Anything at all can be found and put in.
  await planning.plan.search("whenever")
  await planning.plan.expectSuggestions(["Whenever"])

  today = await planning.done()
  await today.expectTasks(["H-3 Pay the bill", "H-4 Research boilers", "H-1 Fix the tap"])
  await tab.expectLogged(["today.taskPlanned", "today.taskPlanned"])

  // The order's kept for the day.
  const again = await (await taxa.openTab("Matt")).openInbox()
  await (
    await again.sidebar.openList("Today")
  ).expectTasks(["H-3 Pay the bill", "H-4 Research boilers", "H-1 Fix the tap"])
})
