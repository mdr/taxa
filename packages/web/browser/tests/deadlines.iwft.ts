import { Horizon } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("Deadlines lists what's due, soonest first, under when, and the sidebar counts what's coming up", async ({
  taxa
}) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("File the tax return", { domain: "H", due: "2026-03-31" })
  await taxa.matt.addTask("Book the MOT", { domain: "H", due: "2026-01-09" })
  await taxa.matt.addTask("Pay the bill", { domain: "H", due: "2026-01-02" })
  await taxa.matt.addTask("Renew passport", { domain: "H", horizon: Horizon.SOMEDAY, due: "2026-02-10" })
  await taxa.matt.addTask("Send the form", { domain: "H", due: "2026-01-14" })
  await taxa.matt.addTask("Renew the insurance", { domain: "H", due: "2026-01-05" })
  await taxa.matt.addTask("Post the cards", { domain: "H", due: "2026-01-30" })
  await taxa.matt.addTask("Tidy the shed", { domain: "H" })
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.expectDeadlinesCount(3, true)

  const deadlines = await inbox.sidebar.openDeadlines()
  await deadlines.expectDeadlines([
    ["Overdue", ["H-3 Pay the bill"]],
    ["Today", ["H-6 Renew the insurance"]],
    ["This week", ["H-2 Book the MOT"]],
    ["Next week", ["H-5 Send the form"]],
    ["January", ["H-7 Post the cards"]],
    ["February", ["H-4 Renew passport"]],
    ["March", ["H-1 File the tax return"]]
  ])
  await deadlines.expectHighlights("Pay the bill", "Due Fri 2 Jan · 3 days late")
  await deadlines.expectHighlights("Book the MOT", "Due Fri 9 Jan · in 4 days")
  await deadlines.expectHighlights("File the tax return", "Due Tue 31 Mar · in 3 months")
  await deadlines.expectAccessible()

  await deadlines.complete("Pay the bill")
  await deadlines.sidebar.expectDeadlinesCount(2)
})

test("Today brings deadlines coming up, and leads to them all", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Book the MOT", { domain: "H", due: "2026-01-09" })
  await taxa.matt.addTask("Send the form", { domain: "H", due: "2026-01-14" })
  const today = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openList("Today"))
  await today.deadlines.expectOffered(["Book the MOT: Due Fri 9 Jan · in 4 days"])
  await today.deadlines.openMore("All deadlines")
  await today.expectHeading("Deadlines")
  await today.expectDeadlines([
    ["This week", ["H-1 Book the MOT"]],
    ["Next week", ["H-2 Send the form"]]
  ])
})

test("Deadlines says how to have some, when there are none", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Tidy the shed", { domain: "H" })
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.expectDeadlinesCount(0)
  const deadlines = await inbox.sidebar.openDeadlines()
  await deadlines.expectTasks([])
  await deadlines.expectAccessible()
})
