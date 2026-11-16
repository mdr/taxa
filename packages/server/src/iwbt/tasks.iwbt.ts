import { describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { uuidv7 } from "@taxa/shared/ids"
import { Energy, Priority, TaskStatus } from "@taxa/shared/tasks/task"
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

  it("puts a bare title in the default domain's Inbox", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const task = await matt.addTask("Renew passport")
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

  it("files a task in the domain it names, out of the Inbox, with the fields given", async ({ server }) => {
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
    expect((await matt.client.createTask({ id, title: "Made offline" })).id).toBe(id)
    await expectProblem(matt.client.createTask({ id, title: "Again" }), ProblemType.INVALID_REQUEST)
  })

  it("creates once per Idempotency-Key, however often it's retried", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const first = await matt.client.createTask({ title: "Call the bank" }, "retry-me")
    const again = await matt.client.createTask({ title: "Call the bank" }, "retry-me")
    expect(again).toEqual(first)
    expect(await matt.client.tasks()).toHaveLength(1)
  })

  it("needs a domain to put it in", async ({ server }) => {
    const matt = await server.user("Matt")
    await expectProblem(matt.addTask("Homeless"), ProblemType.NO_DOMAIN)
  })

  it("refuses dates that aren't dates", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await expectProblem(matt.addTask("Bad", { due: "2026-02-30" }), ProblemType.INVALID_REQUEST)
    await expectProblem(matt.addTask("Bad", { scheduledTime: "25:00" }), ProblemType.INVALID_REQUEST)
  })
})

describe("listing tasks", () => {
  const it = useInProcessServer()

  it("shows active tasks, most urgent first, then soonest due", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("Later")
    await matt.addTask("Soon", { due: "2026-01-06" })
    await matt.addTask("Now", { priority: Priority.URGENT })
    const done = await matt.addTask("Done already")
    await matt.client.changeStatus(done.ref, { status: TaskStatus.DONE })
    expect((await matt.client.tasks()).map(({ title }) => title)).toEqual(["Now", "Soon", "Later"])
    expect((await matt.client.tasks({ status: "done" })).map(({ title }) => title)).toEqual(["Done already"])
  })

  it("filters by domain and by Inbox", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("Captured")
    await matt.addTask("At home", { domain: "H" })
    await matt.addTask("Personal, filed", { domain: "M" })
    expect((await matt.client.tasks({ domain: "H" })).map(({ title }) => title)).toEqual(["At home"])
    expect((await matt.client.tasks({ inbox: "true" })).map(({ title }) => title)).toEqual(["Captured"])
  })

  it("hides tasks until their start date, in the person's time zone", async ({ server }) => {
    const matt = await mattWithDomains(server)
    await matt.addTask("From tomorrow", { start: "2026-01-06" })
    expect(await matt.client.tasks()).toEqual([])
    expect(await matt.client.tasks({ includeNotStarted: "true" })).toHaveLength(1)
    server.advance(15 * 60 * 60 * 1000)
    expect(await matt.client.tasks()).toHaveLength(1)
  })

  it("shows nobody else's tasks", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const jo = await server.user("Jo")
    await jo.addDomain("Jo", "J")
    const secret = await matt.addTask("Surprise party")
    expect(await jo.client.tasks()).toEqual([])
    await expectProblem(jo.client.task(secret.ref), ProblemType.NOT_FOUND)
    await expectProblem(jo.client.updateTask(secret.ref, { set: { title: "Ha" } }), ProblemType.NOT_FOUND)
  })

  it("names unknown statuses and domains", async ({ server }) => {
    const matt = await mattWithDomains(server)
    const status = await expectProblem(matt.client.tasks({ status: "OPEN,SNOOZED" }), ProblemType.INVALID_REQUEST)
    expect(status.message).toContain("SNOOZED")
    await expectProblem(matt.client.tasks({ domain: "Z" }), ProblemType.NOT_FOUND)
  })
})
