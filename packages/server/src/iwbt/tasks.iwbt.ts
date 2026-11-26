import { describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { uuidv7 } from "@taxa/shared/ids"
import { Energy, Horizon, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { ClearableField, type CreateTaskRequest, type ListTasksQuery } from "@taxa/shared/tasks/task-requests"
import { expectProblem } from "../test-support/problems.ts"
import type { TestUser } from "../test-support/test-user.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"
import type { InProcessServer } from "../test-support/in-process-server.ts"

const mattWithDomains = async (server: InProcessServer): Promise<TestUser> => {
  const matt = await server.user("Matt")
  await matt.addDomain("Personal", "M")
  await matt.addDomain("Home", "H")
  return matt
}

describe("creating tasks", () => {
  const it = useInProcessServer()

  it("puts a task that says nothing of when in your Inbox, in its domain, to sort out", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const task = await matt.addTask("Renew passport", { domain: "M" })
    expect(task).toMatchObject({
      ref: "M-1",
      title: "Renew passport",
      notes: "",
      status: TaskStatus.OPEN,
      priority: Priority.NORMAL,
      inbox: true,
      version: 1,
      createdAt: "2026-01-05T09:00:00.000Z"
    })
  })

  it("files a task said to be for a day straight into the domain it names, with the fields given", async ({
    server
  }) => {
    const matt = await mattWithDomains(server)
    const task = await matt.addTask("Fix the tap", {
      domain: "h",
      due: "2026-01-09",
      scheduled: "2026-01-08",
      scheduledTime: "18:30",
      priority: Priority.HIGH,
      estimateMinutes: 30,
      energy: Energy.LOW,
      notes: "Washer, probably."
    })
    expect(task).toMatchObject({
      ref: "H-1",
      inbox: false,
      due: "2026-01-09",
      scheduled: "2026-01-08",
      scheduledTime: "18:30",
      priority: Priority.HIGH,
      estimateMinutes: 30,
      energy: Energy.LOW,
      notes: "Washer, probably."
    })
  })

  it("numbers tasks across every domain, so a number alone names one", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("One", { domain: "M" })
    await matt.addTask("Two", { domain: "H" })
    const three = await matt.addTask("Three", { domain: "M" })
    expect(three.ref).toBe("M-3")
    for (const ref of ["M-3", "m-3", "H-3", "3", three.id]) {
      expect((await matt.client.task(ref)).title).toBe("Three")
    }
  })

  it("takes the client's own id, so a task made offline keeps it", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const id = uuidv7(server.clock.now())
    expect((await matt.client.createTask({ id, title: "Made offline", domain: "M" })).id).toBe(id)
    await expectProblem(matt.client.createTask({ id, title: "Again", domain: "M" }), ProblemType.INVALID_REQUEST)
  })

  it("creates once per Idempotency-Key, however often it's retried", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const first = await matt.client.createTask({ title: "Call the bank", domain: "M" }, "retry-me")
    const again = await matt.client.createTask({ title: "Call the bank", domain: "M" }, "retry-me")
    expect(again).toEqual(first)
    expect(await matt.client.tasks()).toHaveLength(1)
  })

  it("puts a task in the only domain there is, and asks which when there are more, or none yet", async ({ server }) => {
    const matt = await server.user("Matt")
    const none = await expectProblem(matt.addTask("Get started"), ProblemType.INVALID_REQUEST)
    expect(none.message).toBe("Add a domain first: every task goes in one.")
    await matt.addDomain("Home", "H")
    expect(await matt.addTask("Fix the tap")).toMatchObject({ ref: "H-1", inbox: true })
    await matt.addDomain("Work", "W")
    const which = await expectProblem(matt.addTask("Plan the quarter"), ProblemType.INVALID_REQUEST)
    expect(which.message).toBe("Say which domain it goes in: H, W.")
  })

  it("files a task given a when, unless it's asked to be in the Inbox; and the other way round", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const inbox = async (fields: Omit<CreateTaskRequest, "title">): Promise<boolean> =>
      (await matt.addTask("Task", { domain: "M", ...fields })).inbox
    expect(await inbox({ scheduled: "2026-01-06" })).toBe(false)
    expect(await inbox({ horizon: Horizon.SOMEDAY })).toBe(false)
    expect(await inbox({ due: "2026-01-09" })).toBe(true)
    expect(await inbox({ horizon: Horizon.SOON, inbox: true })).toBe(true)
    expect(await inbox({ inbox: false })).toBe(false)
  })

  it("refuses dates that aren't dates", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await expectProblem(matt.addTask("Bad", { domain: "M", due: "2026-02-30" }), ProblemType.INVALID_REQUEST)
    await expectProblem(matt.addTask("Bad", { domain: "M", scheduledTime: "25:00" }), ProblemType.INVALID_REQUEST)
  })
})

describe("listing tasks", () => {
  const it = useInProcessServer()

  it("shows active tasks, most urgent first, then soonest due", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("Later", { domain: "M" })
    await matt.addTask("Soon", { domain: "M", due: "2026-01-06" })
    await matt.addTask("Now", { domain: "M", priority: Priority.URGENT })
    const done = await matt.addTask("Done already", { domain: "M" })
    await matt.client.changeStatus(done.ref, { status: TaskStatus.DONE })
    expect((await matt.client.tasks()).map(({ title }) => title)).toEqual(["Now", "Soon", "Later"])
    expect((await matt.client.tasks({ status: "done" })).map(({ title }) => title)).toEqual(["Done already"])
  })

  it("finds tasks by words in their title or notes, those still to do and found by title first", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("Call the plumber", { domain: "M", notes: "About the kitchen tap" })
    const ordered = await matt.addTask("Order a tap", { domain: "M" })
    await matt.client.changeStatus(ordered.ref, { status: TaskStatus.DONE })
    await matt.addTask("Fix the kitchen tap", { domain: "H" })
    await matt.addTask("Bleed the radiators", { domain: "M" })
    const titles = async (query: ListTasksQuery): Promise<string[]> =>
      (await matt.client.tasks(query)).map(({ title }) => title)
    expect(await titles({ search: "tap" })).toEqual(["Fix the kitchen tap", "Call the plumber"])
    expect(await titles({ search: "Kitchen TAP", status: "open,done" })).toEqual([
      "Fix the kitchen tap",
      "Call the plumber"
    ])
    expect(await titles({ search: "tap", status: "open,done" })).toEqual([
      "Fix the kitchen tap",
      "Call the plumber",
      "Order a tap"
    ])
    expect(await titles({ search: "tap", domain: "H" })).toEqual(["Fix the kitchen tap"])
    expect(await titles({ search: "tap boiler" })).toEqual([])
  })

  it("filters by domain and by Inbox", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("Captured", { domain: "M" })
    await matt.addTask("At home", { domain: "H", inbox: false })
    await matt.addTask("Personal, filed", { domain: "M", inbox: false })
    const titles = async (query: ListTasksQuery): Promise<string[]> =>
      (await matt.client.tasks(query)).map(({ title }) => title).sort()
    expect(await titles({ domain: "H" })).toEqual(["At home"])
    // Still to sort out, it's in its domain, and in the Inbox.
    expect(await titles({ domain: "M" })).toEqual(["Captured", "Personal, filed"])
    expect(await titles({ domain: "M", inbox: "false" })).toEqual(["Personal, filed"])
    expect((await matt.client.tasks({ inbox: "true" })).map(({ title }) => title)).toEqual(["Captured"])
    expect(await matt.client.tasks({ inbox: "false" })).toHaveLength(2)
  })

  it("hides tasks until their start date, in the person's time zone", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("From tomorrow", { domain: "M", start: "2026-01-06" })
    expect(await matt.client.tasks()).toEqual([])
    expect(await matt.client.tasks({ includeNotStarted: "true" })).toHaveLength(1)
    server.advance(15 * 60 * 60 * 1000)
    expect(await matt.client.tasks()).toHaveLength(1)
  })

  it("lists tasks by when they're meant for, leaving out someday ones unless asked", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("Today's", { domain: "M", scheduled: "2026-01-05" })
    await matt.addTask("Yesterday's", { domain: "M", scheduled: "2026-01-04" })
    await matt.addTask("Next week's", { domain: "M", scheduled: "2026-01-12" })
    await matt.addTask("Soon", { domain: "M", horizon: Horizon.SOON })
    await matt.addTask("One day", { domain: "M", horizon: Horizon.SOMEDAY })
    await matt.addTask("Whenever", { domain: "M" })
    const titles = async (query: ListTasksQuery): Promise<string[]> =>
      (await matt.client.tasks(query)).map(({ title }) => title).sort()
    expect(await titles({})).toEqual(["Next week's", "Soon", "Today's", "Whenever", "Yesterday's"])
    expect(await titles({ when: "TODAY" })).toEqual(["Today's", "Yesterday's"])
    expect(await titles({ when: "soon,someday" })).toEqual(["One day", "Soon"])
    expect(await titles({ when: "ANY_TIME" })).toEqual(["Whenever"])
    await expectProblem(matt.client.tasks({ when: "LATER" }), ProblemType.INVALID_REQUEST)
  })

  it("lists deadlines: only tasks with a due date, soonest first, someday ones too", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("Urgent, due later", { domain: "M", priority: Priority.URGENT, due: "2026-02-01" })
    await matt.addTask("One day, due soon", { domain: "M", horizon: Horizon.SOMEDAY, due: "2026-01-09" })
    await matt.addTask("Overdue, today's", { domain: "M", scheduled: "2026-01-05", due: "2026-01-02" })
    await matt.addTask("No deadline", { domain: "M", priority: Priority.URGENT })
    const titles = async (query: ListTasksQuery): Promise<string[]> =>
      (await matt.client.tasks(query)).map(({ title }) => title)
    expect(await titles({ due: "true" })).toEqual(["Overdue, today's", "One day, due soon", "Urgent, due later"])
    expect(await titles({ due: "true", when: "TODAY" })).toEqual(["Overdue, today's"])
  })

  it("keeps when a task was put in soon or someday, until it comes out", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const started = new Date(server.clock.now()).toISOString()
    const task = await matt.addTask("Research boilers", { domain: "M", horizon: Horizon.SOON })
    expect(task.horizonSetAt).toBe(started)
    server.advance(60_000)
    expect((await matt.client.updateTask(task.ref, { set: { title: "Research heat pumps" } })).horizonSetAt).toBe(
      started
    )
    const someday = await matt.client.updateTask(task.ref, { set: { horizon: Horizon.SOMEDAY } })
    expect(someday.horizonSetAt).toBe(new Date(server.clock.now()).toISOString())
    const out = await matt.client.updateTask(task.ref, { clear: [ClearableField.HORIZON] })
    expect(out.horizonSetAt).toBeUndefined()
  })

  it("links a task to the one it follows on from, finds what one led to, and refuses loops", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const disks = await matt.addTask("Back up the floppy disks", { domain: "H" })
    await matt.client.changeStatus(disks.ref, { status: TaskStatus.DONE })
    const dispose = await matt.addTask("Dispose of the disks", { domain: "H", followsOn: disks.ref })
    expect(dispose.followsOnId).toBe(disks.id)
    const photos = await matt.addTask("Upload the photos", { domain: "H" })
    expect((await matt.client.updateTask(photos.ref, { set: { followsOn: disks.id } })).followsOnId).toBe(disks.id)
    expect((await matt.client.tasks({ followsOn: disks.ref, status: "OPEN,DONE" })).map(({ title }) => title)).toEqual([
      "Dispose of the disks",
      "Upload the photos"
    ])

    await expectProblem(
      matt.client.updateTask(disks.ref, { set: { followsOn: disks.ref } }),
      ProblemType.INVALID_REQUEST
    )
    await expectProblem(
      matt.client.updateTask(disks.ref, { set: { followsOn: dispose.ref } }),
      ProblemType.INVALID_REQUEST
    )
    const jo = await server.user("Jo")
    await jo.addDomain("Jo", "J")
    await expectProblem(jo.addTask("Mine", { domain: "J", followsOn: disks.id }), ProblemType.NOT_FOUND)

    const unlinked = await matt.client.updateTask(photos.ref, { clear: [ClearableField.FOLLOWS_ON] })
    expect(unlinked.followsOnId).toBeUndefined()
    expect((await matt.client.tasks({ followsOn: disks.ref })).map(({ title }) => title)).toEqual([
      "Dispose of the disks"
    ])
  })

  it("shows nobody else's tasks, in their domains or their Inbox", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const jo = await server.user("Jo")
    await jo.addDomain("Jo", "J")
    const captured = await matt.addTask("Surprise party", { domain: "M" })
    const filed = await matt.addTask("Buy a present", { domain: "H" })
    expect(await jo.client.tasks()).toEqual([])
    expect(await jo.client.tasks({ inbox: "true" })).toEqual([])
    for (const secret of [captured, filed]) {
      await expectProblem(jo.client.task(secret.ref), ProblemType.NOT_FOUND)
      await expectProblem(jo.client.updateTask(secret.ref, { set: { title: "Ha" } }), ProblemType.NOT_FOUND)
    }
  })

  it("keeps a task in your Inbox to yourself, in a domain you share, until it's filed", async ({ server }) => {
    const matt = await server.user("Matt")
    const home = await matt.addDomain("Home", "H")
    const jo = await server.user("Jo")
    await server.shareDomain(home.id, jo)
    const idea = await matt.addTask("Surprise party")
    const shared = await matt.addTask("Fix the tap", { inbox: false })
    expect((await jo.client.tasks({ domain: "H" })).map(({ ref }) => ref)).toEqual([shared.ref])
    await expectProblem(jo.client.task(idea.ref), ProblemType.NOT_FOUND)
    // Filed, it's the domain's; put back by Jo, it's in Jo's Inbox, and out of Matt's sight.
    await matt.client.updateTask(idea.ref, { set: { inbox: false } })
    expect((await jo.client.tasks({ domain: "H" })).map(({ ref }) => ref).sort()).toEqual([idea.ref, shared.ref])
    await jo.client.updateTask(shared.ref, { set: { inbox: true } })
    expect((await jo.client.tasks({ inbox: "true" })).map(({ ref }) => ref)).toEqual([shared.ref])
    await expectProblem(matt.client.task(shared.ref), ProblemType.NOT_FOUND)
  })

  it("names unknown statuses and domains", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const status = await expectProblem(matt.client.tasks({ status: "OPEN,SNOOZED" }), ProblemType.INVALID_REQUEST)
    expect(status.message).toContain("SNOOZED")
    await expectProblem(matt.client.tasks({ domain: "Z" }), ProblemType.NOT_FOUND)
  })
})
