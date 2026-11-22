import type { TaskId } from "@taxa/shared/ids"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { describe, expect } from "vite-plus/test"
import type { InProcessServer } from "../../../server/src/test-support/in-process-server.ts"
import type { TestUser } from "../../../server/src/test-support/test-user.ts"
import { useInProcessServer } from "../../../server/src/test-support/use-in-process-server.ts"
import type { TaskCache } from "../tasks/changes/task-cache.ts"
import { TaskChangesService, TaskChangeType } from "../tasks/changes/task-changes-service.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"
import { FakeScheduler } from "../test-support/fake-scheduler.ts"
import { testTelemetry, type TestTelemetry } from "../test-support/test-telemetry.ts"
import { NoticeType, UNDO_NOTICE_MS, UndoService } from "./undo-service.ts"

class FakeTaskCache implements TaskCache {
  readonly #tasks = new Map<TaskId, Task>()

  readonly latest = (id: TaskId): Task | undefined => this.#tasks.get(id)

  readonly show = (task: Task): Promise<void> => {
    this.#tasks.set(task.id, task)
    return Promise.resolve()
  }
}

interface Setup {
  matt: TestUser
  undo: UndoService
  changes: TaskChangesService
  scheduler: FakeScheduler
  telemetry: TestTelemetry
}

/** Matt's tab: its changes, and their history. */
const makeUndoService = async (server: InProcessServer): Promise<Setup> => {
  const matt = await server.user("Matt")
  await matt.addDomain("Home", "H")
  const cache = new FakeTaskCache()
  const scheduler = new FakeScheduler()
  const telemetry = testTelemetry()
  const undo = new UndoService(matt.client, cache, telemetry.analytics, scheduler)
  const changes = new TaskChangesService(matt.client, cache, telemetry.analytics, telemetry.logger, undo)
  return { matt, undo, changes, scheduler, telemetry }
}

describe("UndoService", () => {
  const it = useInProcessServer()

  it("undoes the tab's changes, last first, across tasks, and redoes them", async ({ server }) => {
    const { matt, undo, changes } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const bins = await matt.addTask("Put the bins out", { domain: "H" })
    await changes.change(tap, { type: TaskChangeType.UPDATE, request: { set: { priority: Priority.HIGH } } })
    await changes.change(bins, { type: TaskChangeType.STATUS, request: { status: TaskStatus.DONE } })

    await undo.undo()
    expect((await matt.client.task(bins.id)).status).toBe(TaskStatus.OPEN)
    expect(undo.state.notice).toEqual({ type: NoticeType.UNDONE, text: "Undid: Marked H-2 done" })
    await undo.undo()
    expect((await matt.client.task(tap.id)).priority).toBe(Priority.NORMAL)
    await undo.redo()
    expect((await matt.client.task(tap.id)).priority).toBe(Priority.HIGH)
    expect(undo.state.notice).toEqual({ type: NoticeType.REDONE, text: "Redid: Changed H-1" })
    await undo.redo()
    expect((await matt.client.task(bins.id)).status).toBe(TaskStatus.DONE)
    expect(undo.state.redoable).toEqual([])

    // Pressed quickly, each waits for the one before.
    await Promise.all([undo.undo(), undo.undo(), undo.redo()])
    expect((await matt.client.task(bins.id)).status).toBe(TaskStatus.OPEN)
    expect((await matt.client.task(tap.id)).priority).toBe(Priority.HIGH)
  })

  it("deletes a task added by mistake, and a new change forgets what was undone", async ({ server }) => {
    const { matt, undo, changes } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const oops = await matt.addTask("Fix the tpa", { domain: "H" })
    undo.recordAdded(oops)
    await undo.undo()
    expect((await matt.client.tasks({})).map(({ title }) => title)).toEqual(["Fix the tap"])
    expect(undo.state.notice?.text).toBe("Undid: Added H-2")
    await changes.change(tap, { type: TaskChangeType.UPDATE, request: { set: { title: "Fix the kitchen tap" } } })
    expect(undo.state.redoable).toEqual([])
  })

  it("undoes a change on offer wherever it is in the history", async ({ server }) => {
    const { matt, undo, changes } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const bins = await matt.addTask("Put the bins out", { domain: "H" })
    const done = await changes.change(tap, { type: TaskChangeType.STATUS, request: { status: TaskStatus.DONE } })
    await changes.change(bins, { type: TaskChangeType.UPDATE, request: { set: { priority: Priority.LOW } } })
    if (!done) throw new Error("not done")
    expect((await undo.undoChange(done))?.status).toBe(TaskStatus.OPEN)
    expect(undo.state.undoable.map(({ label }) => label)).toEqual(["Changed H-2"])
  })

  it("says why it couldn't undo, keeping the change undone no further, and tracks what it did", async ({ server }) => {
    const { matt, undo, changes, scheduler, telemetry } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    await changes.change(tap, { type: TaskChangeType.UPDATE, request: { set: { priority: Priority.HIGH } } })
    await matt.client.updateTask(tap.id, { set: { priority: Priority.LOW } })
    await undo.undo()
    expect(undo.state.notice?.type).toBe(NoticeType.REFUSED)
    expect(undo.state.notice?.text).toContain("undo the later change first")
    scheduler.advance(UNDO_NOTICE_MS)
    expect(undo.state.notice).toBeUndefined()

    const bins = await matt.addTask("Put the bins out", { domain: "H" })
    undo.recordAdded(bins)
    await undo.undo()
    await undo.redo()
    expect(
      telemetry
        .tracked()
        .filter(([code]) => code === ANALYTICS_CODES.task.undone || code === ANALYTICS_CODES.task.redone)
    ).toEqual([
      [ANALYTICS_CODES.task.undone, { taskId: bins.id, taskRef: "H-2" }],
      [ANALYTICS_CODES.task.redone, { taskId: bins.id, taskRef: "H-2" }]
    ])
  })
})
