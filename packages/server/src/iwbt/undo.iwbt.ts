import { describe, expect } from "vite-plus/test"
import { ActivityType } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

describe("undo", () => {
  const it = useInProcessServer()

  it("takes back any change by the version it brought the task to, and undoing that redoes it", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const tap = await matt.addTask("Fix the tap")
    const filed = await matt.client.updateTask(tap.ref, { set: { domain: "H", priority: Priority.HIGH } })
    const done = await matt.client.changeStatus(filed.ref, { status: TaskStatus.DONE })

    const undone = await matt.client.undoTask(tap.id, done.version)
    expect(undone).toMatchObject({ status: TaskStatus.OPEN, version: 4 })
    expect(undone.completedAt).toBeUndefined()
    const refiled = await matt.client.undoTask(tap.id, filed.version)
    expect(refiled).toMatchObject({ ref: "IN-1", inbox: true, priority: Priority.NORMAL })
    const redone = await matt.client.undoTask(tap.id, undone.version)
    expect(redone).toMatchObject({ status: TaskStatus.DONE })

    const log = await matt.client.activity(tap.id)
    expect(log.map(({ type, version, undoesVersion }) => [type, version, undoesVersion])).toEqual([
      [ActivityType.TASK_CREATED, 1, undefined],
      [ActivityType.TASK_UPDATED, 2, undefined],
      [ActivityType.TASK_STATUS_CHANGED, 3, undefined],
      [ActivityType.TASK_UPDATED, 4, 3],
      [ActivityType.TASK_UPDATED, 5, 2],
      [ActivityType.TASK_UPDATED, 6, 4]
    ])
  })

  it("takes back a task added by mistake, not even leaving it in the bin, and redoes it", async ({ server }) => {
    const matt = await server.user("Matt")
    const oops = await matt.addTask("Fix the tpa")
    const deleted = await matt.client.undoTask(oops.id, oops.version)
    expect(deleted.deletedAt).toBeDefined()
    expect(await matt.client.tasks({})).toEqual([])
    expect(await matt.client.tasks({ deleted: "true" })).toEqual([])
    const restored = await matt.client.undoTask(oops.id, deleted.version)
    expect(restored.deletedAt).toBeUndefined()
    const again = await matt.client.undoTask(oops.id, restored.version)
    expect(again.deletedAt).toBeDefined()
    expect(await matt.client.tasks({ deleted: "true" })).toEqual([])
  })

  it("puts a deleted task back in the bin, undoing restoring it", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    await matt.client.deleteTask(tap.ref)
    const restored = await matt.client.restoreTask(tap.ref)
    await matt.client.undoTask(tap.id, restored.version)
    expect((await matt.client.tasks({ deleted: "true" })).map(({ title }) => title)).toEqual(["Fix the tap"])
  })

  it("undoes an agent's change, and won't undo what's been changed since", async ({ server }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code")
    const tap = await matt.addTask("Fix the tap")
    const byClaude = await claude.client.updateTask(tap.id, {
      set: { priority: Priority.URGENT, title: "FIX THE TAP" }
    })
    await matt.client.updateTask(tap.id, { set: { priority: Priority.LOW } })
    const refused = await expectProblem(matt.client.undoTask(tap.id, byClaude.version), ProblemType.VERSION_CONFLICT)
    expect(refused.message).toContain("undo the later change first")
    await expectProblem(matt.client.undoTask(tap.id, 99), ProblemType.NOT_FOUND)
  })
})
