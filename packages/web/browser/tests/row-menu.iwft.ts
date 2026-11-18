import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("changing a task from its menu in a list, without opening it", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addDomain("Work", "W")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.addTask("Bleed the radiators", { domain: "H" })
  await taxa.matt.addTask("Book the MOT", { domain: "H" })
  const home = await (await (await taxa.openTab("Matt")).openInbox()).sidebar.openDomain("Home")

  let menu = await home.openMenu("Fix the tap")
  await menu.expectShows("Status", "Open")
  await menu.expectShows("Priority", "Normal")
  await menu.expectShows("Due date", "None")
  await menu.expectShows("Estimate", "None")
  await menu.expectShows("Move to", "Home")
  await menu.expectAccessible()
  await menu.lookAtAndBack("Priority")
  await menu.setPriority(Priority.HIGH)
  await home.expectHighlights("Fix the tap", "High")
  await taxa.expectTask("H-1", { priority: Priority.HIGH })

  menu = await home.openMenu("Book the MOT")
  await menu.setDue("2026-01-06")
  await home.expectHighlights("Book the MOT", "Due Tue 6 Jan")
  menu = await home.openMenu("Book the MOT")
  await menu.setEstimate("45m")
  await taxa.expectTask("H-3", { due: "2026-01-06", estimateMinutes: 45 })
  menu = await home.openMenu("Book the MOT")
  await menu.expectShows("Estimate", "45m")
  await menu.closeWithEscape()

  menu = await home.openMenu("Bleed the radiators")
  await menu.setStatus(TaskStatus.IN_PROGRESS)
  await home.expectHighlights("Bleed the radiators", "In progress")
  await taxa.expectTask("H-2", { status: TaskStatus.IN_PROGRESS })

  // Moved or deleted, a task leaves the list.
  menu = await home.openMenu("Fix the tap")
  await menu.moveTo("W")
  await home.expectTasks(["H-2 Bleed the radiators", "H-3 Book the MOT"])
  await taxa.expectTask("W-1", { title: "Fix the tap" })
  menu = await home.openMenu("Book the MOT")
  await menu.delete()
  await home.expectTasks(["H-2 Bleed the radiators"])
  await taxa.expectTaskCount(2)
})
