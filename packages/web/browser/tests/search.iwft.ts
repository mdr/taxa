import { TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("searching a list by title or notes, finished tasks included", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the kitchen tap", { domain: "H" })
  await taxa.matt.addTask("Call the plumber", { domain: "H", notes: "About the tap: it drips" })
  await taxa.matt.addTask("Bleed the radiators", { domain: "H" })
  await taxa.matt.addTask("Buy a tap washer", { domain: "H" })
  await taxa.matt.changeStatus("H-4", TaskStatus.DONE)
  const home = await (await (await taxa.openTab("Matt")).openInbox()).sidebar.openDomain("Home")
  await home.expectTasks(["H-1 Fix the kitchen tap", "H-2 Call the plumber", "H-3 Bleed the radiators"])

  await home.search("tap")
  await home.expectTasks(["H-1 Fix the kitchen tap", "H-2 Call the plumber"])
  await home.expectFinished(["✓ H-4 Buy a tap washer"])
  await home.search("Drips TAP")
  await home.expectTasks(["H-2 Call the plumber"])
  await home.expectAccessible()

  await home.search("washer")
  await home.expectNoMatches("Nothing still to do matches")
  await home.expectFinished(["✓ H-4 Buy a tap washer"])
  await home.search("boiler")
  await home.expectNoMatches("Nothing here matches “boiler”")

  await home.clearSearchWithEscape()
  await home.expectTasks(["H-1 Fix the kitchen tap", "H-2 Call the plumber", "H-3 Bleed the radiators"])
  await home.searchFromKeyboard("radiators")
  await home.expectTasks(["H-3 Bleed the radiators"])
})

test("finding any task from the command menu, by title or notes", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the kitchen tap", { domain: "H" })
  await taxa.matt.addTask("Buy a tap washer", { domain: "H" })
  await taxa.matt.changeStatus("H-2", TaskStatus.DONE)
  await taxa.matt.addTask("Call the plumber", { notes: "About the tap" })
  const tab = await taxa.openTab("Matt")
  const inbox = await tab.openInbox()

  const menu = await inbox.keyboard.openCommandMenu()
  await menu.search("tap")
  await menu.expectFoundTasks(["H-1 Fix the kitchen tap", "IN-3 Call the plumber", "H-2 Buy a tap washer"])
  await menu.expectAccessible()
  await menu.search("tap washer")
  await menu.expectFoundTasks(["H-2 Buy a tap washer"])
  const washer = await menu.openFoundTask("Buy a tap washer")
  await washer.expectStatus(TaskStatus.DONE)
  await tab.expectLogged(["commandMenu.opened", "commandMenu.taskOpened"])
})
