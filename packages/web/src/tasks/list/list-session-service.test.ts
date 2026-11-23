import type { TaskId } from "@taxa/shared/ids"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { isCelebrated, isShownDone, ListSessionService, Step, Undo, UNDO_OFFERED_MS } from "./list-session-service.ts"
import { FakeScheduler } from "../../test-support/fake-scheduler.ts"
import { testTelemetry, type TestTelemetry } from "../../test-support/test-telemetry.ts"
import { TaskChangeType, type TaskChange, type TaskChangesActions } from "../changes/task-changes-service.ts"
import type { UndoActions } from "../../undo/undo-service.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"

/** Task changes the test answers itself, one at a time, as the server would. */
class FakeTaskChanges implements TaskChangesActions {
  readonly asked: { task: Task; change: TaskChange; answer: (task: Task | undefined) => void }[] = []
  /** Every change asked for, in order, answered or not. */
  readonly made: { task: Task; change: TaskChange }[] = []

  readonly change = (task: Task, change: TaskChange): Promise<Task | undefined> => {
    this.made.push({ task, change })
    return new Promise((answer) => this.asked.push({ task, change, answer }))
  }

  readonly clearProblems = (): void => undefined

  /** Answers the oldest change as made, with the status it asked for; or as refused. */
  async answer(made = true): Promise<void> {
    const asked = this.asked.shift()
    if (!asked) throw new Error("no change to answer")
    const status = asked.change.type === TaskChangeType.STATUS ? asked.change.request.status : asked.task.status
    asked.answer(made ? { ...asked.task, status, version: asked.task.version + 1 } : undefined)
    await Promise.resolve()
    await Promise.resolve()
  }
}

/** The tab's history, undoing what it's asked to as the server would, or refusing. */
class FakeHistory implements Pick<UndoActions, "undo" | "undoChange" | "isLatest"> {
  readonly undone: Task[] = []
  undoneLast = 0
  refuse = false
  /** Whether what's on offer is still the last change. */
  latest = true

  readonly isLatest = (): boolean => this.latest

  readonly undo = (): Promise<void> => {
    this.undoneLast += 1
    return Promise.resolve()
  }

  readonly undoChange = (task: Task): Promise<Task | undefined> => {
    this.undone.push(task)
    return Promise.resolve(this.refuse ? undefined : { ...task, status: TaskStatus.OPEN, version: task.version + 1 })
  }
}

const makeListSessionService = (): {
  history: FakeHistory
  changes: FakeTaskChanges
  scheduler: FakeScheduler
  session: ListSessionService
  telemetry: TestTelemetry
} => {
  const changes = new FakeTaskChanges()
  const history = new FakeHistory()
  const scheduler = new FakeScheduler()
  const telemetry = testTelemetry()
  return {
    changes,
    history,
    scheduler,
    telemetry,
    session: new ListSessionService(changes, history, scheduler, telemetry.analytics)
  }
}

describe("ListSessionService", () => {
  it("deletes a task, offering to undo it", async () => {
    const { changes, history, session } = makeListSessionService()
    const task = makeTask({ title: "Fix the tap" })
    const deleting = session.delete(task, [task.id])
    await changes.answer()
    await deleting
    expect(changes.made.map(({ change }) => change.type)).toEqual([TaskChangeType.DELETE])
    expect(session.state.undoable?.id).toBe(task.id)
    expect(session.state.undoes).toBe(Undo.DELETE)
    await session.undo()
    expect(history.undone.map(({ id, version }) => [id, version])).toEqual([[task.id, task.version + 1]])
    expect(session.state.undoable).toBeUndefined()
  })

  it("offers nothing to undo when the server refuses a delete", async () => {
    const { changes, session } = makeListSessionService()
    const task = makeTask()
    const deleting = session.delete(task, [task.id])
    await changes.answer(false)
    await deleting
    expect(session.state.undoable).toBeUndefined()
  })

  it("starts on the task last opened from the list, coming back to it", () => {
    const { changes, scheduler, telemetry } = makeListSessionService()
    const memory = new Map<string, TaskId>()
    const opened = { recall: () => memory.get("list"), remember: (id: TaskId) => void memory.set("list", id) }
    const first = new ListSessionService(changes, new FakeHistory(), scheduler, telemetry.analytics, opened)
    expect(first.state.highlighted).toBeUndefined()
    first.rememberOpened(makeTask({ number: 2 }))
    expect(
      new ListSessionService(changes, new FakeHistory(), scheduler, telemetry.analytics, opened).state.highlighted
    ).toBe(makeTask({ number: 2 }).id)
  })

  it("keeps what's typed to search the list, tracked once a visit", () => {
    const { session, telemetry } = makeListSessionService()
    session.search("tap")
    session.search("")
    session.search("radiators")
    expect(session.state.search).toBe("radiators")
    expect(telemetry.tracked()).toEqual([[ANALYTICS_CODES.list.searched, {}]])
  })

  it("shows a tick at once, keeps the task in place once it's done, and offers to undo it", async () => {
    const { changes, session } = makeListSessionService()
    const task = makeTask()
    const ticking = session.toggle(task)
    expect(isShownDone(session.state, task)).toBe(true)
    expect(isCelebrated(session.state, task.id)).toBe(true)
    expect(session.state.undoable).toBeUndefined()
    expect(session.state.ticked[task.id]).toBe(task)

    await changes.answer()
    await ticking
    expect(isShownDone(session.state, task)).toBe(true)
    expect(session.state.ticked[task.id]?.status).toBe(TaskStatus.DONE)
    expect(session.state.undoable?.id).toBe(task.id)
  })

  it("takes a tick back when the server refuses it", async () => {
    const { changes, session } = makeListSessionService()
    const task = makeTask()
    const ticking = session.toggle(task)
    await changes.answer(false)
    await ticking
    expect(isShownDone(session.state, task)).toBe(false)
    expect(session.state.ticked).toEqual({ [task.id]: undefined })
    expect(session.state.undoable).toBeUndefined()
  })

  it("undoes a tick through the tab's history, unticking it at once", async () => {
    const { changes, history, session } = makeListSessionService()
    const task = makeTask()
    const ticking = session.toggle(task)
    await changes.answer()
    await ticking

    const undoing = session.undo()
    expect(session.state.undoable).toBeUndefined()
    expect(isShownDone(session.state, task)).toBe(false)
    await undoing
    expect(history.undone.map(({ status }) => status)).toEqual([TaskStatus.DONE])
    expect(session.state.ticked[task.id]).toBeUndefined()
    expect(isShownDone(session.state, task)).toBe(false)
  })

  it("undoes the tab's last change instead of a tick on offer, once something else has changed", async () => {
    const { changes, history, session } = makeListSessionService()
    const task = makeTask()
    const ticking = session.toggle(task)
    await changes.answer()
    await ticking
    history.latest = false

    await session.undo()
    expect(history.undone).toEqual([])
    expect(history.undoneLast).toBe(1)
    expect(session.state.undoable).toBeUndefined()
    expect(isShownDone(session.state, task)).toBe(true)
  })

  it("keeps the tick when undoing it is refused", async () => {
    const { changes, history, session } = makeListSessionService()
    const task = makeTask()
    const ticking = session.toggle(task)
    await changes.answer()
    await ticking
    history.refuse = true
    await session.undo()
    expect(isShownDone(session.state, task)).toBe(true)
  })

  it("withdraws the offer to undo after a few seconds, leaving the task done", async () => {
    const { changes, scheduler, session } = makeListSessionService()
    const task = makeTask()
    const ticking = session.toggle(task)
    await changes.answer()
    await ticking

    scheduler.advance(UNDO_OFFERED_MS - 1)
    expect(session.state.undoable?.id).toBe(task.id)
    scheduler.advance(1)
    expect(session.state.undoable).toBeUndefined()
    expect(isShownDone(session.state, task)).toBe(true)
  })

  it("offers to undo only the latest tick, and stops when that task is unticked", async () => {
    const { changes, session } = makeListSessionService()
    const [first, second] = [makeTask({ number: 1 }), makeTask({ number: 2 })]
    const ticks = [session.toggle(first), session.toggle(second)]
    await changes.answer()
    await changes.answer()
    await Promise.all(ticks)
    expect(session.state.undoable?.id).toBe(second.id)

    const unticking = session.toggle(second)
    await changes.answer()
    await unticking
    expect(session.state.undoable).toBeUndefined()
    expect(isShownDone(session.state, first)).toBe(true)
  })

  it("unticks a task finished before the list opened, with no celebration", async () => {
    const { changes, session } = makeListSessionService()
    const finished = makeTask({ status: TaskStatus.DONE })
    expect(isShownDone(session.state, finished)).toBe(true)
    expect(isCelebrated(session.state, finished.id)).toBe(false)

    const unticking = session.toggle(finished)
    expect(isShownDone(session.state, finished)).toBe(false)
    await changes.answer()
    await unticking
    expect(session.state.undoable).toBeUndefined()
  })

  it("keeps celebrating a tick once the server takes it, but not an untick", async () => {
    const { changes, session } = makeListSessionService()
    const task = makeTask()
    const ticking = session.toggle(task)
    await changes.answer()
    await ticking
    expect(isCelebrated(session.state, task.id)).toBe(true)

    const unticking = session.toggle(task)
    expect(isCelebrated(session.state, task.id)).toBe(false)
    await changes.answer()
    await unticking
    expect(isCelebrated(session.state, task.id)).toBe(false)
  })

  it("keeps showing one tick while another, refused, goes back", async () => {
    const { changes, session } = makeListSessionService()
    const [first, second] = [makeTask({ number: 1 }), makeTask({ number: 2 })]
    const ticks = [session.toggle(first), session.toggle(second)]
    await changes.answer(false)
    expect(isShownDone(session.state, first)).toBe(false)
    expect(isShownDone(session.state, second)).toBe(true)
    await changes.answer()
    await Promise.all(ticks)
  })

  it("still offers to undo the last tick when a later one is refused", async () => {
    const { changes, session } = makeListSessionService()
    const [first, second] = [makeTask({ number: 1 }), makeTask({ number: 2 })]
    const ticking = session.toggle(first)
    await changes.answer()
    await ticking

    const refused = session.toggle(second)
    await changes.answer(false)
    await refused
    expect(session.state.undoable?.id).toBe(first.id)
  })

  it("still offers to undo the last tick when another task is unticked, for no longer", async () => {
    const { changes, scheduler, session } = makeListSessionService()
    const ticked = makeTask({ number: 1 })
    const finished = makeTask({ number: 2, status: TaskStatus.DONE })
    const ticking = session.toggle(ticked)
    await changes.answer()
    await ticking

    scheduler.advance(UNDO_OFFERED_MS - 1000)
    const unticking = session.toggle(finished)
    await changes.answer()
    await unticking
    expect(session.state.undoable?.id).toBe(ticked.id)
    scheduler.advance(1000)
    expect(session.state.undoable).toBeUndefined()
  })

  it("undoes the tab's last change when there's no tick or delete on offer", async () => {
    const { history, session } = makeListSessionService()
    await session.undo()
    expect(history.undoneLast).toBe(1)
    expect(history.undone).toEqual([])
  })

  it("stops its timer when the list goes", async () => {
    const { changes, scheduler, session } = makeListSessionService()
    const ticking = session.toggle(makeTask())
    await changes.answer()
    await ticking
    expect(scheduler.waiting).toBe(1)
    session.dispose()
    expect(scheduler.waiting).toBe(0)
  })
})

describe("ListSessionService's highlight", () => {
  const [first, second, third] = [makeTask({ number: 1 }), makeTask({ number: 2 }), makeTask({ number: 3 })]
  const shown = [first.id, second.id, third.id]

  it("starts on the first task going down, or the last going up", () => {
    const { session } = makeListSessionService()
    session.moveHighlight(shown, Step.NEXT)
    expect(session.state.highlighted).toBe(first.id)
    session.highlight(undefined)
    session.moveHighlight(shown, Step.PREVIOUS)
    expect(session.state.highlighted).toBe(third.id)
  })

  it("moves a task at a time, and stops at the ends", () => {
    const { session } = makeListSessionService()
    session.highlight(second.id)
    session.moveHighlight(shown, Step.NEXT)
    expect(session.state.highlighted).toBe(third.id)
    session.moveHighlight(shown, Step.NEXT)
    expect(session.state.highlighted).toBe(third.id)
    session.moveHighlight(shown, Step.PREVIOUS)
    session.moveHighlight(shown, Step.PREVIOUS)
    session.moveHighlight(shown, Step.PREVIOUS)
    expect(session.state.highlighted).toBe(first.id)
  })

  it("starts again from the top when the highlighted task is no longer shown", () => {
    const { session } = makeListSessionService()
    session.highlight(second.id)
    session.moveHighlight([first.id, third.id], Step.NEXT)
    expect(session.state.highlighted).toBe(first.id)
  })

  it("highlights nothing in an empty list", () => {
    const { session } = makeListSessionService()
    session.moveHighlight([], Step.NEXT)
    expect(session.state.highlighted).toBeUndefined()
  })

  it("goes on to the next task when the highlighted one is filed, or back from the last", () => {
    const { changes, session } = makeListSessionService()
    session.highlight(second.id)
    void session.file(second, { set: { domain: "H" } }, shown)
    expect(session.state.highlighted).toBe(third.id)
    expect(changes.asked.map(({ task, change }) => [task.id, change])).toEqual([
      [second.id, { type: TaskChangeType.UPDATE, request: { set: { domain: "H" } } }]
    ])
    void session.file(third, { set: { domain: "H" } }, [first.id, third.id])
    expect(session.state.highlighted).toBe(first.id)
    void session.file(first, { set: { domain: "H" } }, [first.id])
    expect(session.state.highlighted).toBeUndefined()
  })

  it("leaves the highlight alone when another task is filed", () => {
    const { session } = makeListSessionService()
    session.highlight(first.id)
    void session.file(third, { set: { domain: "H" } }, shown)
    expect(session.state.highlighted).toBe(first.id)
  })
})
