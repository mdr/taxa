import { Horizon, Priority } from "@taxa/shared/tasks/task"
import { When } from "@taxa/shared/tasks/when"
import { test } from "../fixtures/taxa-fixture.ts"

test("choosing when a task's meant for from its menu in a list, someday ones going out of sight", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.addTask("Book the MOT", { domain: "H" })
  await taxa.matt.addTask("Learn the banjo", { domain: "H" })
  const home = await (await (await taxa.openTab("Matt")).openInbox()).sidebar.openDomain("Home")

  let menu = await home.openMenu("Fix the tap")
  await menu.expectShows("When", "Any time")
  await menu.setWhen(When.TODAY)
  await taxa.expectTask("H-1", { scheduled: "2026-01-05", horizon: undefined })
  menu = await home.openMenu("Fix the tap")
  await menu.expectShows("When", "Today")
  await menu.closeWithEscape()

  menu = await home.openMenu("Book the MOT")
  await menu.setWhen(When.SOON)
  await taxa.expectTask("H-2", { scheduled: undefined, horizon: Horizon.SOON })
  menu = await home.openMenu("Book the MOT")
  await menu.expectShows("When", "Soon")
  // Planned for a day, it's no longer just soon.
  await menu.setWhenOnADay("2026-01-09")
  await taxa.expectTask("H-2", { scheduled: "2026-01-09", horizon: undefined })
  menu = await home.openMenu("Book the MOT")
  await menu.expectShows("When", "Fri 9 Jan")
  await menu.closeWithEscape()

  menu = await home.openMenu("Learn the banjo")
  await menu.setWhen(When.SOMEDAY)
  await home.expectTasks(["H-1 Fix the tap", "H-2 Book the MOT"])
  await taxa.expectTask("H-3", { horizon: Horizon.SOMEDAY })

  // Out of sight, but still to be found.
  const find = await home.keyboard.openCommandMenu()
  await find.search("banjo")
  await find.expectFoundTasks(["H-3 Learn the banjo"])
})

test("choosing when a task's meant for on its page, a date taking over from soon", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap")
  const task = await (await taxa.openTab("Matt")).openTask("H-1")
  await task.expectWhen(When.ANY_TIME, "When")

  await task.setWhen(When.TODAY)
  await task.expectWhen(When.TODAY, "Today")
  await task.expectScheduled("2026-01-05", "Mon 5 Jan")
  await task.setWhen(When.SOON)
  await task.expectWhen(When.SOON, "Soon")
  await task.expectScheduled("", "Scheduled")
  await taxa.expectTask("H-1", { scheduled: undefined, horizon: Horizon.SOON })

  await task.scheduleFor("Tomorrow")
  await task.expectWhen(When.ON_A_DAY, "Tue 6 Jan")
  await taxa.expectTask("H-1", { scheduled: "2026-01-06", horizon: undefined })
  await task.setWhen(When.ANY_TIME)
  await task.expectWhen(When.ANY_TIME, "When")
  await taxa.expectTask("H-1", { scheduled: undefined, horizon: undefined })
})

test("seeing what's meant for today, soon and someday, across domains", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addDomain("Work", "W")
  await taxa.matt.addTask("Fix the tap", { domain: "H", scheduled: "2026-01-05" })
  await taxa.matt.addTask("Send the quote", { domain: "W", scheduled: "2026-01-02" })
  await taxa.matt.addTask("Book the MOT", { domain: "H", scheduled: "2026-01-09" })
  await taxa.matt.addTask("Research boilers", { domain: "H", horizon: Horizon.SOON })
  await taxa.matt.addTask("Order Jo's gift", { domain: "W", horizon: Horizon.SOON, priority: Priority.HIGH })
  await taxa.matt.addTask("Learn the banjo", { domain: "H", horizon: Horizon.SOMEDAY })
  await taxa.matt.addTask("Bleed the radiators", { domain: "H" })
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.expectCount("Today", 2)
  await inbox.sidebar.expectCount("Soon", 2)
  await inbox.sidebar.expectCount("Someday", 1)

  // A domain's rows say when each is meant for; any time says nothing.
  const home = await inbox.sidebar.openDomain("Home")
  await home.expectTasks(["H-1 Fix the tap", "H-3 Book the MOT", "H-4 Research boilers", "H-7 Bleed the radiators"])
  await home.expectHighlights("Fix the tap", "Today")
  await home.expectHighlights("Book the MOT", "Fri 9 Jan")
  await home.expectHighlights("Research boilers", "Soon")
  await home.expectHighlights("Bleed the radiators", "")

  // Today has what was meant for earlier days and isn't done yet; its rows needn't say today.
  const today = await home.sidebar.openList("Today")
  await today.expectTasks(["H-1 Fix the tap", "W-2 Send the quote"])
  await today.expectHighlights("Fix the tap", "")
  await today.complete("Fix the tap")
  await today.sidebar.expectCount("Today", 1)

  const soon = await today.sidebar.openList("Soon")
  await soon.expectTasks(["W-5 Order Jo's gift", "H-4 Research boilers"])
  await soon.expectHighlights("Order Jo's gift", "High")

  // Brought back from someday, it's in Soon instead.
  const someday = await soon.sidebar.openList("Someday")
  await someday.expectTasks(["H-6 Learn the banjo"])
  const menu = await someday.openMenu("Learn the banjo")
  await menu.setWhen(When.SOON)
  await someday.expectTasks([])
  await someday.sidebar.expectCount("Someday", 0)
  await someday.sidebar.expectCount("Soon", 3)
  await someday.expectAccessible()
})
