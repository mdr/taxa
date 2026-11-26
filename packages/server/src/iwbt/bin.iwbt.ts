import { describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { BIN_KEEPS_MS, UNCREATED_KEEPS_MS } from "@taxa/shared/tasks/bin"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

const DAY = 24 * 60 * 60 * 1000

describe("the bin", () => {
  const it = useInProcessServer()

  it("deletes a task in it for good, leaving nothing of what was written", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const tap = await matt.addTask("Fix the tap", { domain: "H", notes: "The kitchen one", tags: ["plumbing"] })
    await matt.client.updateTask(tap.ref, { set: { title: "Fix the kitchen tap" } })
    await matt.client.deleteTask(tap.ref)
    await matt.client.purgeTask(tap.ref)
    expect(await matt.client.tasks({ deleted: "true" })).toEqual([])
    await expectProblem(matt.client.task(tap.ref), ProblemType.NOT_FOUND)
    await expectProblem(matt.client.restoreTask(tap.ref), ProblemType.NOT_FOUND)
    await expectProblem(matt.client.undoTask(tap.ref, 3), ProblemType.NOT_FOUND)
    expect(await server.stored(tap.id)).toEqual({ title: "", notes: "", tags: [], logged: [{}, {}, {}] })
    expect(server.logs.at(-1)).toMatchObject({ code: "task.purged", fields: { taskId: tap.id } })
  })

  it("won't delete for good a task that isn't in the bin, nor one someone can't see", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const anna = await server.user("Anna")
    const tap = await matt.addTask("Fix the tap")
    await expectProblem(matt.client.purgeTask(tap.ref), ProblemType.INVALID_REQUEST)
    await matt.client.deleteTask(tap.ref)
    await expectProblem(anna.client.purgeTask(tap.ref), ProblemType.NOT_FOUND)
    expect((await matt.client.tasks({ deleted: "true" })).map(({ ref }) => ref)).toEqual([tap.ref])
  })

  it("empties the bin of what each person can see, and nothing else", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const anna = await server.user("Anna")
    await anna.addDomain("Anna", "A")
    const tap = await matt.addTask("Fix the tap")
    const bins = await matt.addTask("Put the bins out")
    const kept = await matt.addTask("Book the dentist")
    const hers = await anna.addTask("Water the plants")
    for (const task of [tap, bins]) await matt.client.deleteTask(task.ref)
    await anna.client.deleteTask(hers.ref)
    expect(await matt.client.emptyBin()).toBe(2)
    expect(await matt.client.tasks({ deleted: "true" })).toEqual([])
    expect((await matt.client.tasks()).map(({ ref }) => ref)).toEqual([kept.ref])
    expect((await anna.client.tasks({ deleted: "true" })).map(({ ref }) => ref)).toEqual([hers.ref])
    expect(await matt.client.emptyBin()).toBe(0)
  })

  it("clears out tasks uncreated by an undo after a day, kept that long only for redoing it", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const oops = await matt.addTask("Fix the tpa")
    await matt.client.undoTask(oops.id, oops.version)
    server.advance(UNCREATED_KEEPS_MS)
    expect(await server.clearOldBin()).toBe(0)
    server.advance(1)
    expect(await server.clearOldBin()).toBe(1)
    expect((await server.stored(oops.id)).title).toBe("")
  })

  it("clears out tasks left in it for 30 days", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const old = await matt.addTask("Fix the tap")
    const recent = await matt.addTask("Put the bins out")
    await matt.client.deleteTask(old.ref)
    server.advance(DAY)
    await matt.client.deleteTask(recent.ref)
    server.advance(BIN_KEEPS_MS - DAY)
    expect(await server.clearOldBin()).toBe(0)
    server.advance(1)
    expect(await server.clearOldBin()).toBe(1)
    expect((await matt.client.tasks({ deleted: "true" })).map(({ ref }) => ref)).toEqual([recent.ref])
    expect((await server.stored(old.id)).title).toBe("")
    expect(server.logs.at(-1)).toMatchObject({ code: "bin.cleared", fields: { count: 1 } })
  })
})
