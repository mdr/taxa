import { Priority } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("what's done with controls is tracked, named by what they're for", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.addTask("Bleed the radiators", { domain: "H" })
  const tab = await taxa.openTab("Matt")
  const home = await (await tab.openInbox()).sidebar.openDomain("Home")

  // A menu opening, a choice in it and another within, and its closing.
  await (await home.openMenu("Fix the tap")).setPriority(Priority.HIGH)
  await tab.expectLogged([
    "ui.opened TaskRow.menu",
    "ui.chosen TaskRowMenu.main",
    "ui.chosen TaskRowMenu.priority",
    "ui.closed TaskRow.menu",
    "task.changed"
  ])

  // A date typed into a picker: one edit, however it's finished.
  await (await home.openMenu("Fix the tap")).setDue("2026-01-09")
  await tab.expectLogged(["ui.opened TaskRow.menu", "ui.edited TaskRowMenu.due.typed", "ui.closed TaskRow.menu"])

  // A box ticked, and a field edited in place.
  await home.complete("Bleed the radiators")
  await home.keyboard.press("j")
  await home.keyboard.renameRow("Fix the kitchen tap")
  await tab.expectLogged(["ui.toggled TaskRow.done", "ui.edited RowTitleField.field"])

  // A dialog opening, a button in it, and its closing.
  const help = await home.keyboard.openShortcuts()
  await help.close()
  await tab.expectLogged([
    "ui.opened ShortcutsHelp.dialog",
    "ui.clicked ShortcutsHelp.close",
    "ui.closed ShortcutsHelp.dialog"
  ])
})
