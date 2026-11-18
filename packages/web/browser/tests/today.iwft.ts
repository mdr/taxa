import { Horizon, Priority } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

const DAY = 24 * 60 * 60 * 1000

test("Today says what's been carried over, and offers what might want doing today", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Fix the tap", { domain: "H", scheduled: "2026-01-05" })
  await taxa.matt.addTask("Send the quote", { domain: "H", scheduled: "2026-01-02" })
  await taxa.matt.addTask("Pay the bill", { domain: "H", due: "2026-01-02" })
  await taxa.matt.addTask("Renew the insurance", { domain: "H", due: "2026-01-05" })
  await taxa.matt.addTask("Call Mum", { domain: "H", horizon: Horizon.SOON, priority: Priority.URGENT })
  await taxa.matt.addTask("Book the MOT", { domain: "H", due: "2026-01-04" })
  await taxa.matt.addTask("Research boilers", { domain: "H", horizon: Horizon.SOON })
  const today = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openList("Today"))

  await today.expectTasks(["H-1 Fix the tap", "H-2 Send the quote"])
  await today.expectHighlights("Fix the tap", "")
  await today.expectHighlights("Send the quote", "Carried over from Fri 2 Jan")
  await today.attention.expectOffered([
    "Pay the bill: Overdue since Fri 2 Jan",
    "Book the MOT: Overdue since Sun 4 Jan",
    "Renew the insurance: Due today"
  ])
  await today.expectAccessible()

  await today.attention.planForToday("Book the MOT")
  // With no order planned, today's tasks come most pressing first.
  await today.expectTasks(["H-6 Book the MOT", "H-1 Fix the tap", "H-2 Send the quote"])
  await taxa.expectTask("H-6", { scheduled: "2026-01-05" })
  await today.attention.expectOffered([
    "Pay the bill: Overdue since Fri 2 Jan",
    "Renew the insurance: Due today",
    "Call Mum: Soon · urgent"
  ])

  await today.attention.planForToday("Pay the bill")
  await today.attention.planForToday("Renew the insurance")
  await today.attention.planForToday("Call Mum")
  await today.attention.expectNothingOffered()
})

test("Today's box points to Plan today when there's more than it shows", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  for (const title of ["One", "Two", "Three", "Four"])
    await taxa.matt.addTask(title, { domain: "H", due: "2026-01-05" })
  const today = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openList("Today"))
  await today.attention.expectOffered(["One: Due today", "Two: Due today", "Three: Due today"])
  const planning = await today.attention.reviewAll(4)
  await planning.plan.expectSuggestions(["One", "Two", "Three", "Four"])
})

test("Soon asks after a task that's sat in it four weeks", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Look into a standing desk", { domain: "H", horizon: Horizon.SOON })
  await taxa.advance(20 * DAY)
  await taxa.matt.addTask("Research boilers", { domain: "H", horizon: Horizon.SOON })
  await taxa.advance(9 * DAY)
  const soon = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openList("Soon"))
  await soon.expectHighlights("Look into a standing desk", "In Soon for 4 weeks")
  await soon.expectHighlights("Research boilers", "")
  const home = await soon.sidebar.openDomain("Home")
  await home.expectHighlights("Research boilers", "Soon")
})

test("a session starts from today's tasks, in the order planned", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Bleed the radiators", { domain: "H", priority: Priority.URGENT })
  const tap = await taxa.matt.addTask("Fix the tap", { domain: "H", scheduled: "2026-01-05" })
  const quote = await taxa.matt.addTask("Send the quote", { domain: "H", scheduled: "2026-01-05" })
  await taxa.matt.client.setDayPlan("2026-01-05", { taskIds: [quote.id, tap.id] })
  const setup = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openSession())
  const planner = await setup.chooseTasks()
  await planner.plan.expectSuggestions(["Send the quote", "Fix the tap", "Bleed the radiators"])
})
