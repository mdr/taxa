import { Horizon } from "@taxa/shared/tasks/task"
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
  const task = await (await taxa.openTab("Matt")).openTask("IN-1")
  await task.expectWhen(When.ANY_TIME, "When")

  await task.setWhen(When.TODAY)
  await task.expectWhen(When.TODAY, "Today")
  await task.expectScheduled("2026-01-05", "Mon 5 Jan")
  await task.setWhen(When.SOON)
  await task.expectWhen(When.SOON, "Soon")
  await task.expectScheduled("", "Scheduled")
  await taxa.expectTask("IN-1", { scheduled: undefined, horizon: Horizon.SOON })

  await task.scheduleFor("Tomorrow")
  await task.expectWhen(When.ON_A_DAY, "Tue 6 Jan")
  await taxa.expectTask("IN-1", { scheduled: "2026-01-06", horizon: undefined })
  await task.setWhen(When.ANY_TIME)
  await task.expectWhen(When.ANY_TIME, "When")
  await taxa.expectTask("IN-1", { scheduled: undefined, horizon: undefined })
})
