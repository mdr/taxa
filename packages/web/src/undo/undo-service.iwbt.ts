import type { ChecklistRequest } from "@taxa/shared/tasks/checklist"
import type { TaxaClient } from "@taxa/shared/api/taxa-client"
import type { TaskId } from "@taxa/shared/ids"
import type { ChangeStatusRequest, RecordOccurrenceRequest, UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import type { Version } from "@taxa/shared/units"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { describe, expect } from "vite-plus/test"
import type { InProcessServer } from "../../../server/src/test-support/in-process-server.ts"
import type { TestUser } from "../../../server/src/test-support/test-user.ts"
import { useInProcessServer } from "../../../server/src/test-support/use-in-process-server.ts"
import { ChangeOrder } from "../tasks/changes/change-order.ts"
import type { TaskCache } from "../tasks/changes/task-cache.ts"
import { TaskChangesService, TaskChangeType, type TaskChangesApi } from "../tasks/changes/task-changes-service.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"
import { FakeScheduler } from "../test-support/fake-scheduler.ts"
import { testTelemetry, type TestTelemetry } from "../test-support/test-telemetry.ts"
import { NoticeType, UNDO_NOTICE_MS, UndoService, type CommentCache, type UndoApi } from "./undo-service.ts"
import { CommentsService, type CommentsApi } from "../tasks/comments/comments-service.ts"
import type { AddCommentRequest, Comment, EditCommentRequest } from "@taxa/shared/comments/comment"
import type { CommentId } from "@taxa/shared/ids"

class FakeTaskCache implements TaskCache {
  readonly #tasks = new Map<TaskId, Task>()

  readonly latest = (id: TaskId): Task | undefined => this.#tasks.get(id)

  readonly show = (task: Task): Promise<void> => {
    this.#tasks.set(task.id, task)
    return Promise.resolve()
  }
}

/**
 * The server over a slow network: each request reaches it at once, but while
 * answers are held, none comes back until they're let go; or, unreachable, a
 * request fails without reaching it.
 */
class SlowServer implements TaskChangesApi, UndoApi, CommentsApi {
  readonly #client: TaxaClient
  #held: Promise<void> = Promise.resolve()
  #letGo = (): void => undefined
  unreachable = false
  /** The next answer's lost on the way back, though the server's done what was asked. */
  loseNextAnswer = false

  constructor(client: TaxaClient) {
    this.#client = client
  }

  holdAnswers(): void {
    this.#held = new Promise((resolve) => (this.#letGo = resolve))
  }

  letAnswersGo(): void {
    this.#letGo()
  }

  async #answer<T>(ask: () => Promise<T>): Promise<T> {
    if (this.unreachable) throw new TypeError("Failed to fetch")
    const answer = await ask()
    await this.#held
    if (this.loseNextAnswer) {
      this.loseNextAnswer = false
      throw new TypeError("Failed to fetch")
    }
    return answer
  }

  readonly task = (ref: string): Promise<Task> => this.#answer(() => this.#client.task(ref))
  readonly updateTask = (ref: string, request: UpdateTaskRequest, ifMatch?: Version): Promise<Task> =>
    this.#answer(() => this.#client.updateTask(ref, request, ifMatch))
  readonly changeStatus = (ref: string, request: ChangeStatusRequest, ifMatch?: Version): Promise<Task> =>
    this.#answer(() => this.#client.changeStatus(ref, request, ifMatch))
  readonly deleteTask = (ref: string, ifMatch?: Version): Promise<Task> =>
    this.#answer(() => this.#client.deleteTask(ref, ifMatch))
  readonly restoreTask = (ref: string): Promise<Task> => this.#answer(() => this.#client.restoreTask(ref))
  readonly recordOccurrence = (ref: string, request: RecordOccurrenceRequest): Promise<Task> =>
    this.#answer(() => this.#client.recordOccurrence(ref, request))
  readonly changeChecklist = (ref: string, request: ChecklistRequest): Promise<Task> =>
    this.#answer(() => this.#client.changeChecklist(ref, request))
  readonly undoTask = (ref: string, version: Version): Promise<Task> =>
    this.#answer(() => this.#client.undoTask(ref, version))
  readonly undoComment = (id: CommentId, version: Version): Promise<Comment> =>
    this.#answer(() => this.#client.undoComment(id, version))
  readonly addComment = (ref: string, request: AddCommentRequest, idempotencyKey?: string): Promise<Comment> =>
    this.#answer(() => this.#client.addComment(ref, request, idempotencyKey))
  readonly editComment = (id: CommentId, request: EditCommentRequest, ifMatch?: Version): Promise<Comment> =>
    this.#answer(() => this.#client.editComment(id, request, ifMatch))
  readonly deleteComment = (id: CommentId, ifMatch?: Version): Promise<Comment> =>
    this.#answer(() => this.#client.deleteComment(id, ifMatch))
}

/** Comments shown: how many times one's been shown changed by an undo. */
class FakeCommentCache implements CommentCache {
  shown = 0

  readonly show = (): Promise<void> => Promise.resolve(void this.shown++)
}

interface Setup {
  matt: TestUser
  server: SlowServer
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
  const slow = new SlowServer(matt.client)
  const order = new ChangeOrder()
  const undo = new UndoService(slow, cache, new FakeCommentCache(), telemetry.analytics, scheduler, order)
  const changes = new TaskChangesService(slow, cache, telemetry.analytics, telemetry.logger, undo, order)
  return { matt, server: slow, undo, changes, scheduler, telemetry }
}

describe("UndoService", () => {
  const it = useInProcessServer()

  it("undoes and redoes comments with the tab's other changes: adding, editing and deleting", async ({ server }) => {
    const { matt, undo, changes, telemetry } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const bodies = async (): Promise<string[]> => (await matt.client.comments(tap.id)).map(({ body }) => body)
    const comments = new CommentsService(matt.client, undo, tap, () => Promise.resolve(), telemetry.analytics)
    await changes.change(tap, { type: TaskChangeType.UPDATE, request: { set: { priority: Priority.HIGH } } })
    comments.write("Rang the plumbr")
    await comments.post()

    // The comment's the last change, so it's what's taken back, not the priority.
    await undo.undo()
    expect(await bodies()).toEqual([])
    expect(undo.state.notice).toEqual({ type: NoticeType.UNDONE, text: "Undid: Commented on H-1" })
    expect((await matt.client.task(tap.id)).priority).toBe(Priority.HIGH)
    await undo.redo()
    expect(await bodies()).toEqual(["Rang the plumbr"])

    const [posted] = await matt.client.comments(tap.id)
    comments.startEditing(posted!)
    comments.writeEdit("Rang the plumber")
    await comments.saveEdit(posted!)
    await undo.undo()
    expect(await bodies()).toEqual(["Rang the plumbr"])
    await undo.redo()
    expect(await bodies()).toEqual(["Rang the plumber"])

    const [edited] = await matt.client.comments(tap.id)
    await comments.remove(edited!)
    expect(await bodies()).toEqual([])
    await undo.undo()
    expect(await bodies()).toEqual(["Rang the plumber"])
    expect(telemetry.tracked().map(([code]) => code)).toContain(ANALYTICS_CODES.comment.undone)
  })

  it("waits for a comment still being sent before undoing it", async ({ server }) => {
    const { matt, server: slow, undo, telemetry } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const comments = new CommentsService(slow, undo, tap, () => Promise.resolve(), telemetry.analytics)
    slow.holdAnswers()
    comments.write("Rang the plumber")
    const posting = comments.post()
    const undoing = undo.undo()
    slow.letAnswersGo()
    await Promise.all([posting, undoing])
    expect(await matt.client.comments(tap.id)).toEqual([])
  })

  it("undoes the tab's changes, last first, across tasks, and redoes them", async ({ server }) => {
    const { matt, undo, changes } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const bins = await matt.addTask("Put the bins out", { domain: "H" })
    const high = await changes.change(tap, {
      type: TaskChangeType.UPDATE,
      request: { set: { priority: Priority.HIGH } }
    })
    const done = await changes.change(bins, { type: TaskChangeType.STATUS, request: { status: TaskStatus.DONE } })
    expect([undo.isLatest(done!), undo.isLatest(high!)]).toEqual([true, false])

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
    await undo.add(() => matt.addTask("Fix the tpa", { domain: "H" }))
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

    const bins = await undo.add(() => matt.addTask("Put the bins out", { domain: "H" }))
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

  it("undoes the last change asked for, though its answer hasn't come back yet", async ({ server }) => {
    const { matt, server: slow, undo, changes } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    await changes.change(tap, { type: TaskChangeType.UPDATE, request: { set: { priority: Priority.HIGH } } })
    slow.holdAnswers()
    const ticking = changes.change(tap, { type: TaskChangeType.STATUS, request: { status: TaskStatus.DONE } })
    const undoing = undo.undo()
    slow.letAnswersGo()
    await Promise.all([ticking, undoing])
    expect(undo.state.notice?.text).toBe("Undid: Marked H-1 done")
    const now = await matt.client.task(tap.id)
    expect([now.status, now.priority]).toEqual([TaskStatus.OPEN, Priority.HIGH])
  })

  it("makes a change asked for after an undo once it's answered, building on it", async ({ server }) => {
    const { matt, server: slow, undo, changes } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    await changes.change(tap, { type: TaskChangeType.UPDATE, request: { set: { priority: Priority.HIGH } } })
    slow.holdAnswers()
    const undoing = undo.undo()
    const renaming = changes.change(tap, {
      type: TaskChangeType.UPDATE,
      request: { set: { title: "Fix the kitchen tap" } }
    })
    slow.letAnswersGo()
    await undoing
    expect(await renaming).toMatchObject({ title: "Fix the kitchen tap", priority: Priority.NORMAL })
  })

  it("keeps a change to undo when the server can't be reached, to try again", async ({ server }) => {
    const { matt, server: slow, undo, changes } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    await changes.change(tap, { type: TaskChangeType.UPDATE, request: { set: { priority: Priority.HIGH } } })
    slow.unreachable = true
    await undo.undo()
    expect(undo.state.notice?.type).toBe(NoticeType.REFUSED)
    expect(undo.state.undoable.map(({ label }) => label)).toEqual(["Changed H-1"])
    slow.unreachable = false
    await undo.undo()
    expect((await matt.client.task(tap.id)).priority).toBe(Priority.NORMAL)
  })

  it("looks again at a task when a change's answer is lost, so the next builds on it", async ({ server }) => {
    const { matt, server: slow, changes } = await makeUndoService(server)
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    slow.loseNextAnswer = true
    expect(
      await changes.change(tap, { type: TaskChangeType.UPDATE, request: { set: { priority: Priority.HIGH } } })
    ).toBeUndefined()
    const renamed = await changes.change(tap, {
      type: TaskChangeType.UPDATE,
      request: { set: { title: "Fix the kitchen tap" } }
    })
    expect(renamed).toMatchObject({ title: "Fix the kitchen tap", priority: Priority.HIGH })
  })
})
