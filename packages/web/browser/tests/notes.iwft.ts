import { test } from "../fixtures/taxa-fixture.ts"
import { NotesFormat } from "../../src/notes/notes-format.ts"

test("notes written formatted or as Markdown, and saved as Markdown", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await detail.typeNotes("Buy ")
  await detail.typeNotesFormatted(NotesFormat.BOLD, "washers")
  await taxa.expectTask("H-1", { notes: "Buy **washers**" })
  await detail.expectNotesMarkdown("Buy **washers**")

  await detail.writeNotesAsMarkdown("Steps\n=====\n\n* [ ] turn off the water")
  await taxa.expectTask("H-1", { notes: "# Steps\n\n- [ ] turn off the water" })
  await detail.expectNotesMarkdown("# Steps\n\n- [ ] turn off the water")
  await detail.expectAccessible()

  await detail.showNotesFormatted()
  await detail.expectNotesHeading("Steps")
  await detail.tickNotesItem("turn off the water")
  await taxa.expectTask("H-1", { notes: "# Steps\n\n- [x] turn off the water" })
  await detail.expectAccessible()
})

test("an agent's notes show formatted, and aren't rewritten by being looked at", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Research boilers", { domain: "H", notes: "Options\n-------\n\n* Combi\n* System" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.expectNotesHeading("Options")
  await detail.expectActivity(["Matt created this"])

  const claude = await taxa.matt.agent("Claude Code")
  await claude.changeTask("H-1", { notes: "## Shortlist\n\n- Worcester Bosch" })
  await detail.returnToTab()
  await detail.expectNotesHeading("Shortlist")
  await detail.expectActivity(["Matt created this", "Claude Code for Matt edited the notes"])
  await taxa.expectTask("H-1", { notes: "## Shortlist\n\n- Worcester Bosch" })
})

test("having chosen Markdown, notes open as Markdown", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H", notes: "Buy **washers**" })
  await taxa.matt.addTask("Bleed the radiators", { domain: "H", notes: "- [ ] *Key* from the shed" })
  const tab = await taxa.openTab("Matt")
  await (await tab.openTask("H-1")).expectNotesMarkdown("Buy **washers**")

  await (await tab.openTask("H-2")).expectNotesMarkdown("- [ ] *Key* from the shed")
})

test("an agent's change to notes you only clicked into is shown, not overwritten", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Research boilers", { domain: "H", notes: "Ask around" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.enterNotes()

  const claude = await taxa.matt.agent("Claude Code")
  await claude.changeTask("H-1", { notes: "Shortlist: Worcester Bosch" })
  await detail.returnToTab()
  await detail.expectActivity(["Matt created this", "Claude Code for Matt edited the notes"])
  await detail.expectNotesText("Ask around")

  await detail.leaveNotes()
  await detail.expectNotesText("Shortlist: Worcester Bosch")
  await detail.expectActivity(["Matt created this", "Claude Code for Matt edited the notes"])
  await taxa.expectTask("H-1", { notes: "Shortlist: Worcester Bosch" })
})

test("links in notes, with their own text, added, followed, changed and removed", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await detail.startTypingNotes("Read the ")
  await detail.openLinkForm("keyboard")
  await detail.expectLinkForm("", "")
  await detail.fillLinkForm("manual", "example.com/manual")
  await detail.typeInNotes(" first, then ask on ")
  await detail.openLinkForm("toolbar")
  await detail.fillLinkForm(undefined, "forum.example.com")
  await detail.typeInNotes(" or [the shop](https://shop.example.com) ")
  await detail.leaveNotes()
  await taxa.expectTask("H-1", {
    notes:
      "Read the [manual](https://example.com/manual) first, then ask on https://forum.example.com or [the shop](https://shop.example.com)"
  })

  await detail.clickNotesLink("manual")
  await detail.expectLinkBar("https://example.com/manual")
  await detail.expectAccessible()
  await detail.editLinkFromBar()
  await detail.expectLinkForm("manual", "https://example.com/manual")
  await detail.expectAccessible()
  await detail.fillLinkFormWrongly("javascript:alert(1)")
  await detail.fillLinkForm("fitting guide", "https://example.com/guide")
  await detail.leaveNotes()
  await taxa.expectTask("H-1", {
    notes:
      "Read the [fitting guide](https://example.com/guide) first, then ask on https://forum.example.com or [the shop](https://shop.example.com)"
  })

  await detail.clickNotesLink("the shop")
  await detail.expectLinkBar("https://shop.example.com")
  await detail.removeLinkFromBar()
  await detail.leaveNotes()
  await taxa.expectTask("H-1", {
    notes:
      "Read the [fitting guide](https://example.com/guide) first, then ask on https://forum.example.com or the shop"
  })

  await detail.clickNotesLink("fitting guide")
  await detail.openLinkForm("keyboard")
  await detail.cancelLinkFormWithEscape()
  await detail.leaveNotes()
  await detail.expectNotesMarkdown(
    "Read the [fitting guide](https://example.com/guide) first, then ask on https://forum.example.com or the shop"
  )
})

test("a link in notes that opens a file in VS Code, as agents write them", async ({ taxa }) => {
  const letter = "vscode://file/Users/matt/repos/life/letter.md"
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Reply to the council", { domain: "H", notes: `Draft: [the letter](${letter})` })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await detail.expectNotesLink("the letter", letter)
  await detail.clickNotesLink("the letter")
  await detail.expectLinkBar(letter, false)
})

test("spelling marked in notes only while writing them", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Write to HMRC", { domain: "H", notes: "Ask EduPay for the P60s" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await detail.expectNotesSpellChecked(false)
  await detail.startTypingNotes(" first")
  await detail.expectNotesSpellChecked(true)
  await detail.leaveNotes()
  await detail.expectNotesSpellChecked(false)
})
