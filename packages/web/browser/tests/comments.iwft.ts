import { Priority } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

const MINUTE = 60 * 1000

test("commenting on a task adds to its timeline and leaves the task as it is", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H", notes: "The kitchen one" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await taxa.advance(MINUTE)
  await detail.comments.add("Rang the plumber: he'll come **Thursday**")
  await detail.comments.expectBoxEmpty()
  await taxa.advance(MINUTE)
  await detail.setPriority(Priority.HIGH)
  await taxa.advance(MINUTE)
  await detail.comments.addWithKeyboard("Bought the washers")
  await detail.comments.expectComments([
    { author: "Matt", body: "Rang the plumber: he'll come Thursday" },
    { author: "Matt", body: "Bought the washers" }
  ])
  await detail.comments.expectTimeline([
    "Matt created this",
    "Rang the plumber: he'll come Thursday",
    "Matt set priority to high",
    "Bought the washers"
  ])
  await detail.expectAccessible()
  await taxa.expectComments("H-1", ["Rang the plumber: he'll come **Thursday**", "Bought the washers"])
  await taxa.expectTask("H-1", { notes: "The kitchen one", version: 2 })
})

test("an agent's comment shows under its name, and only your own can be changed", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Research boiler engineers", { domain: "H" })
  const claude = await taxa.matt.agent("Claude Code", "boiler research")
  await claude.client.addComment("H-1", { body: "Found three with good reviews:\n\n- Ace Heating\n- Boilerworks" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.comments.expectComments([
    {
      author: "Claude Code for Matt (boiler research)",
      body: "Found three with good reviews:Ace HeatingBoilerworks"
    }
  ])
  await detail.comments.expectNotChangeable("Found three")
})

test("editing a comment, deleting it, and undoing that", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  await taxa.matt.client.addComment("H-1", { body: "Rang the plumbr" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")

  await detail.comments.abandonEdit("Rang the plumbr", "Never mind")
  await detail.comments.expectComments([{ author: "Matt", body: "Rang the plumbr" }])
  await detail.comments.edit("Rang the plumbr", "Rang the plumber")
  await detail.comments.expectComments([{ author: "Matt", body: "Rang the plumber" }])
  await detail.comments.expectEdited("Rang the plumber")
  await taxa.expectComments("H-1", ["Rang the plumber"])

  await detail.comments.delete("Rang the plumber")
  await detail.comments.expectComments([])
  await taxa.expectComments("H-1", [])
  await detail.comments.undoDelete()
  await detail.comments.expectComments([{ author: "Matt", body: "Rang the plumber" }])
  await taxa.expectComments("H-1", ["Rang the plumber"])
})

test("⌘Z takes back the last thing done to a comment, and ⇧⌘Z puts it back", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H" })
  const detail = await (await taxa.openTab("Matt")).openTask("H-1")
  await detail.setPriority(Priority.HIGH)
  await detail.comments.add("Rang the plumbr")
  await detail.comments.expectComments([{ author: "Matt", body: "Rang the plumbr" }])

  // Posting it was the last change, so that's what's taken back, not the priority.
  await detail.keyboard.press("mod+z")
  await detail.comments.expectComments([])
  await detail.undoNotice.expectSays("Undid: Commented on H-1")
  await taxa.expectComments("H-1", [])
  await taxa.expectTask("H-1", { priority: Priority.HIGH })
  await detail.keyboard.press("mod+Shift+z")
  await detail.comments.expectComments([{ author: "Matt", body: "Rang the plumbr" }])

  await detail.comments.edit("Rang the plumbr", "Rang the plumber")
  await detail.comments.expectComments([{ author: "Matt", body: "Rang the plumber" }])
  await detail.keyboard.press("mod+z")
  await detail.comments.expectComments([{ author: "Matt", body: "Rang the plumbr" }])
  await taxa.expectComments("H-1", ["Rang the plumbr"])

  await detail.comments.delete("Rang the plumbr")
  await detail.comments.expectComments([])
  await detail.keyboard.press("mod+z")
  await detail.comments.expectComments([{ author: "Matt", body: "Rang the plumbr" }])
})
