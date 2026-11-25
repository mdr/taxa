import { TaskStatus } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("a checklist, added to by typing and pasting, ticked off, and the task marked done once it's all ticked", async ({
  taxa
}) => {
  await taxa.matt.addDomain("Personal", "P")
  await taxa.matt.addTask("Move charitable giving", { domain: "P" })
  const detail = await (await taxa.openTab("Matt")).openTask("P-1")

  await detail.checklist.start()
  await detail.checklist.add("Oxfam")
  await detail.checklist.paste("- Shelter\n- RSPB\n")
  await detail.checklist.expectItems(["Oxfam", "Shelter", "RSPB"])
  await detail.checklist.tick("Oxfam")
  await detail.checklist.expectProgress("1/3")
  await detail.checklist.reword("RSPB", "RSPB (monthly)")
  await detail.checklist.remove("Shelter")
  await detail.checklist.expectItems(["✓ Oxfam", "RSPB (monthly)"])
  await detail.expectAccessible()

  await detail.checklist.tick("RSPB (monthly)")
  await detail.checklist.expectFinishedOffer(true)
  await detail.keyboard.press("mod+z")
  await detail.checklist.expectItems(["✓ Oxfam", "RSPB (monthly)"])
  await detail.checklist.expectFinishedOffer(false)
  await detail.checklist.tick("RSPB (monthly)")
  await detail.checklist.markDone()
  await taxa.expectTask("P-1", { status: TaskStatus.DONE })

  const list = await detail.sidebar.openDomain("Personal")
  await list.showFinished()
  await list.expectHighlights("Move charitable giving", "2/2")
})

test("items put in order by dragging, or with the keyboard, and kept in it", async ({ taxa }) => {
  await taxa.matt.addDomain("Personal", "P")
  await taxa.matt.addTask("Move charitable giving", { domain: "P", checklist: ["Oxfam", "Shelter", "RSPB"] })
  const detail = await (await taxa.openTab("Matt")).openTask("P-1")

  await detail.checklist.drag("RSPB", "Oxfam")
  await detail.checklist.expectItems(["RSPB", "Oxfam", "Shelter"])
  await detail.checklist.moveByKeyboard("RSPB", 2)
  await detail.checklist.expectItems(["Oxfam", "Shelter", "RSPB"])
  await detail.checklist.moveByKeyboard("Shelter", -1)
  await detail.checklist.expectItems(["Shelter", "Oxfam", "RSPB"])
  await detail.keyboard.press("mod+z")
  await detail.checklist.expectItems(["Oxfam", "Shelter", "RSPB"])
  await detail.expectAccessible()

  const again = await (await taxa.openTab("Matt")).openTask("P-1")
  await again.checklist.expectItems(["Oxfam", "Shelter", "RSPB"])
})

test("an item made a task of its own is ticked when that task is done", async ({ taxa }) => {
  await taxa.matt.addDomain("Personal", "P")
  await taxa.matt.addTask("Move charitable giving", { domain: "P", checklist: ["Oxfam", "Shelter"] })
  const detail = await (await taxa.openTab("Matt")).openTask("P-1")

  await detail.checklist.makeTask("Oxfam")
  await detail.checklist.expectItems(["Oxfam → P-2", "Shelter"])
  await detail.keyboard.press("mod+z")
  await detail.checklist.expectItems(["Oxfam", "Shelter"])
  const list = await detail.sidebar.openDomain("Personal")
  await list.expectTasks(["P-1 Move charitable giving"])
  const bin = await list.sidebar.openBin()
  await bin.expectTasks([])

  const back = await (await taxa.openTab("Matt")).openTask("P-1")
  await back.checklist.makeTask("Oxfam")
  await back.checklist.expectItems(["Oxfam → P-3", "Shelter"])
  await taxa.expectTask("P-3", { title: "Oxfam" })
  await back.checklist.openItemTask("Oxfam")
  await taxa.matt.client.changeStatus("P-3", { status: TaskStatus.DONE })

  const again = await (await taxa.openTab("Matt")).openTask("P-1")
  await again.checklist.expectItems(["✓ Oxfam → P-3", "Shelter"])
  await again.checklist.expectProgress("1/2")
})
