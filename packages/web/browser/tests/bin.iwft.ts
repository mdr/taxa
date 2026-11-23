import { test } from "../fixtures/taxa-fixture.ts"

test("deleting tasks in the bin forever, one or all of them, once asked", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  for (const title of ["Fix the tap", "Put the bins out", "Book the dentist"]) {
    const task = await taxa.matt.addTask(title, { domain: "H" })
    await taxa.matt.client.deleteTask(task.ref)
    await taxa.advance(60_000)
  }
  const bin = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openBin())
  await bin.expectTasks(["H-3 Book the dentist", "H-2 Put the bins out", "H-1 Fix the tap"])

  const asking = await bin.deleteForever("Fix the tap")
  await asking.expectAsks("Delete “Fix the tap” forever?")
  await asking.expectAccessible()
  await asking.cancel()
  await bin.expectTasks(["H-3 Book the dentist", "H-2 Put the bins out", "H-1 Fix the tap"])

  await (await bin.deleteForever("Fix the tap")).confirm()
  await bin.expectTasks(["H-3 Book the dentist", "H-2 Put the bins out"])

  const emptying = await bin.emptyBin()
  await emptying.expectAsks("Empty the bin?")
  await emptying.confirm()
  await bin.expectEmpty()
  await taxa.expectTaskCount(0)
})
