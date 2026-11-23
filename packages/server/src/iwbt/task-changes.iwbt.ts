import { describe, expect } from "vite-plus/test"
import { ActivityType } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { Horizon, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

const HOUR = 60 * 60 * 1000

describe("changing tasks", () => {
  const it = useInProcessServer()

  it("sets and clears fields, one version at a time", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const task = await matt.addTask("Fix the tap", { due: "2026-01-09" })
    server.advance(HOUR)
    const changed = await matt.client.updateTask(task.ref, {
      set: { title: "Fix the kitchen tap", priority: Priority.HIGH },
      clear: [ClearableField.DUE]
    })
    expect(changed).toMatchObject({ title: "Fix the kitchen tap", priority: Priority.HIGH, version: 2 })
    expect(changed.due).toBeUndefined()
    expect(changed.updatedAt).toBe("2026-01-05T10:00:00.000Z")
  })

  it("leaves the version alone when nothing changes", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const task = await matt.addTask("Fix the tap")
    expect((await matt.client.updateTask(task.ref, { set: { title: "Fix the tap" } })).version).toBe(1)
  })

  it("files a task from the Inbox in a domain, keeping its number", async ({ server }) => {
    const matt = await server.user("Matt")
    const home = await matt.addDomain("Home", "H")
    const task = await matt.addTask("Fix the tap")
    const filed = await matt.client.updateTask(task.ref, { set: { domain: "H" } })
    expect(filed).toMatchObject({ ref: "H-1", domainId: home.id, inbox: false })
    expect((await matt.client.task("IN-1")).ref).toBe("H-1")
    expect(await matt.client.tasks({ inbox: "true" })).toEqual([])
  })

  it("puts a task back in the Inbox, out of its domain", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const task = await matt.addTask("Fix the tap", { domain: "H" })
    const back = await matt.client.updateTask(task.ref, { set: { inbox: true } })
    expect(back).toMatchObject({ ref: "IN-1", inbox: true })
    expect(back.domainId).toBeUndefined()
    expect(await matt.client.tasks({ domain: "H" })).toEqual([])
    await expectProblem(
      matt.client.updateTask(task.ref, { set: { inbox: true, domain: "H" } }),
      ProblemType.INVALID_REQUEST
    )
  })

  it("refuses a change based on an old version, saying what the task is now", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const task = await matt.addTask("Fix the tap")
    await matt.client.updateTask(task.ref, { set: { priority: Priority.HIGH } }, task.version)
    const problem = await expectProblem(
      matt.client.updateTask(task.ref, { set: { priority: Priority.LOW } }, task.version),
      ProblemType.VERSION_CONFLICT
    )
    expect((problem.current as Task).priority).toBe(Priority.HIGH)
    expect((await matt.client.task(task.ref)).priority).toBe(Priority.HIGH)
  })

  it("lets two people's changes to different fields both land", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const claude = await matt.agent("Claude Code")
    const task = await matt.addTask("Fix the tap")
    await Promise.all([
      matt.client.updateTask(task.ref, { set: { due: "2026-01-09" } }),
      claude.client.updateTask(task.ref, { set: { notes: "Washer, probably." } })
    ])
    expect(await matt.client.task(task.ref)).toMatchObject({
      due: "2026-01-09",
      notes: "Washer, probably.",
      version: 3
    })
  })

  it("moves through statuses, keeping what each needs", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const { ref } = await matt.addTask("Get quotes for the boiler")
    const working = await matt.client.changeStatus(ref, { status: TaskStatus.IN_PROGRESS })
    expect(working.inProgressBy).toEqual({ user: { id: expect.any(String), name: "Matt" } })
    const waiting = await matt.client.changeStatus(ref, { status: TaskStatus.WAITING, waitingOn: "Dave's quote" })
    expect(waiting).toMatchObject({ waitingOn: "Dave's quote", followUp: "2026-01-12" })
    expect(waiting.inProgressBy).toBeUndefined()
    server.advance(HOUR)
    const done = await matt.client.changeStatus(ref, { status: TaskStatus.DONE })
    expect(done).toMatchObject({ status: TaskStatus.DONE, completedAt: "2026-01-05T10:00:00.000Z" })
    expect(done.waitingOn).toBeUndefined()
    const cancelled = await matt.client.changeStatus(ref, { status: TaskStatus.CANCELLED, reason: "Kept the old one" })
    expect(cancelled).toMatchObject({ cancelledReason: "Kept the old one" })
    expect(cancelled.completedAt).toBeUndefined()
  })

  it("deletes softly, so a task can be restored", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const task = await matt.addTask("Fix the tap")
    const deleted = await matt.client.deleteTask(task.ref)
    expect(deleted.deletedAt).toBe("2026-01-05T09:00:00.000Z")
    expect(await matt.client.tasks()).toEqual([])
    const restored = await matt.client.restoreTask(task.ref)
    expect(restored.deletedAt).toBeUndefined()
    expect(await matt.client.tasks()).toHaveLength(1)
  })

  it("keeps deleted tasks in the bin, whatever their status, the last deleted first", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    await matt.addDomain("Work", "WK")
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const done = await matt.addTask("Put the bins out", { domain: "H", horizon: Horizon.SOMEDAY })
    const report = await matt.addTask("Write the report", { domain: "WK" })
    await matt.client.changeStatus(done.ref, { status: TaskStatus.DONE })
    await matt.client.deleteTask(done.ref)
    server.advance(60_000)
    await matt.client.deleteTask(tap.ref)
    server.advance(60_000)
    await matt.client.deleteTask(report.ref)
    const bin = async (domain?: string): Promise<string[]> =>
      (await matt.client.tasks({ deleted: "true", domain })).map(({ ref }) => ref)
    expect(await bin()).toEqual(["WK-3", "H-1", "H-2"])
    expect(await bin("H")).toEqual(["H-1", "H-2"])
    expect(await matt.client.tasks()).toEqual([])
  })

  it("logs every change, with who made it", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const task = await matt.addTask("Fix the tap")
    await matt.client.updateTask(task.ref, { set: { priority: Priority.HIGH } })
    await matt.client.changeStatus(task.ref, { status: TaskStatus.DONE })
    await matt.client.deleteTask(task.ref)
    const activity = await matt.client.activity(task.ref)
    expect(activity.map(({ type }) => type)).toEqual([
      ActivityType.TASK_CREATED,
      ActivityType.TASK_UPDATED,
      ActivityType.TASK_STATUS_CHANGED,
      ActivityType.TASK_DELETED
    ])
    expect(activity[1]).toMatchObject({
      actor: { user: { name: "Matt" } },
      changes: { priority: { from: Priority.NORMAL, to: Priority.HIGH } }
    })
    expect(activity.map(({ sequence }) => sequence)).toEqual(
      [...activity.map(({ sequence }) => sequence)].sort((a, b) => a - b)
    )
  })
})
