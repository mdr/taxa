import { test } from "../fixtures/taxa-fixture.ts"

test("tagging tasks on their pages, and finding them by tag", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Renew passport")
  await taxa.matt.addTask("Pay the council tax", { domain: "H" })
  const tab = await taxa.openTab("Matt")
  const passport = await tab.openTask("IN-1")

  // Any words make a tag, spaces and capitals kept.
  await passport.tags.addNew("Life Admin")
  await passport.tags.addNew("errand")
  await passport.tags.expectTags(["Life Admin", "errand"])
  await passport.tags.remove("errand")
  await passport.tags.expectTags(["Life Admin"])
  await taxa.expectTask("IN-1", { tags: ["Life Admin"] })
  await passport.expectAccessible()

  // Another task finds it in any case, and isn't offered a second spelling of it.
  const tax = await tab.openTask("H-2")
  await tax.tags.find("LIFE ADMIN")
  await tax.tags.expectOffered(["Life Admin"])
  await tax.keyboard.press("Escape")
  await tax.tags.addFound("life", "Life Admin")
  await tax.tags.expectTags(["Life Admin"])

  // Its list gathers them from the Inbox and every domain.
  await tax.sidebar.expectTags(["Life Admin2"])
  const lifeAdmin = await tax.sidebar.openTag("Life Admin")
  await lifeAdmin.expectTasks(["IN-1 Renew passport", "H-2 Pay the council tax"])
  // Its rows needn't say so.
  await lifeAdmin.expectHighlights("Renew passport", "")
  await lifeAdmin.expectHighlights("Pay the council tax", "")
  await lifeAdmin.expectAccessible()

  // Renamed there, it's renamed on every task.
  await lifeAdmin.renameTag("Admin")
  await lifeAdmin.expectTasks(["IN-1 Renew passport", "H-2 Pay the council tax"])
  await lifeAdmin.sidebar.expectTags(["Admin2"])
  await taxa.expectTask("H-2", { tags: ["Admin"] })
})

test("tagging a task from its menu in a list", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H", tags: ["DIY"] })
  await taxa.matt.addTask("Bleed the radiators", { domain: "H" })
  await taxa.matt.addTask("Clear the gutters", { domain: "H" })
  const home = await (await (await taxa.openTab("Matt")).openInbox()).sidebar.openDomain("Home")
  let menu = await home.openMenu("Bleed the radiators")
  await menu.expectShows("Tags", "None")
  await menu.addTag("diy")
  await home.expectHighlights("Bleed the radiators", "DIY")
  menu = await home.openMenu("Bleed the radiators")
  await menu.expectShows("Tags", "DIY")
  await menu.addTag("Winter jobs")
  await taxa.expectTask("H-2", { tags: ["DIY", "Winter jobs"] })

  // From the keyboard: L, then Down to the first tag offered, and Enter.
  await home.expectTasks(["H-1 Fix the tap", "H-2 Bleed the radiators", "H-3 Clear the gutters"])
  await home.keyboard.press("j j j")
  await home.expectHighlighted("Clear the gutters")
  await home.keyboard.pickFirstTag("l")
  await taxa.expectTask("H-3", { tags: ["DIY"] })
})

test("tagging a task as you capture it, with #", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Renew passport", { tags: ["Life Admin"] })
  const inbox = await (await taxa.openTab("Matt")).openInbox()

  // A # offers tags as you type, spaces and all; Enter picks one, and Enter again adds the task.
  await inbox.typeCapture("Pay the council tax #life ad")
  await inbox.expectTagsOffered(["> Life Admin", "New tag “life ad”"])
  await inbox.pressInCapture("Enter")
  await inbox.expectCapture("Pay the council tax ", ["Life Admin"])
  await inbox.expectAccessible()
  await inbox.pressInCapture("Enter")
  await inbox.expectHighlights("Pay the council tax", "Life Admin")
  await taxa.expectTask("IN-2", { title: "Pay the council tax", tags: ["Life Admin"] })

  // With no tag like it, Enter makes a new one of what was typed.
  await inbox.typeCapture("Book the MOT #car")
  await inbox.expectTagsOffered(["> New tag “car”"])
  await inbox.pressInCapture("Enter")
  await inbox.pressInCapture("Enter")
  await inbox.expectCapture("", [])
  await taxa.expectTask("IN-3", { title: "Book the MOT", tags: ["car"] })

  // A # inside a word is no tag, and Escape keeps one as text.
  await inbox.typeCapture("Learn C#")
  await inbox.expectTagsOffered([])
  await inbox.typeCapture("Ring #1 fan")
  await inbox.pressInCapture("Escape")
  await inbox.expectTagsOffered([])
  await inbox.pressInCapture("Enter")
  await inbox.expectCapture("", [])
  await taxa.expectTask("IN-4", { title: "Ring #1 fan", tags: [] })
})
