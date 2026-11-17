import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import type { Ms } from "@taxa/shared/units"
import { describe, expect, it } from "vite-plus/test"
import { isCelebrated, isShownDone, ListSessionService, UNDO_OFFERED_MS } from "./list-session-service.ts"
import type { Scheduler } from "../../services/scheduler.ts"
import { TaskChangeType, type TaskChange, type TaskChangesActions } from "../changes/task-changes-service.ts"

/** Task changes the test answers itself, one at a time, as the server would. */
class FakeTaskChanges implements TaskChangesActions {
  readonly asked: { task: Task; change: TaskChange; answer: (task: Task | undefined) => void }[] = []

  readonly change = (task: Task, change: TaskChange): Promise<Task | undefined> =>
    new Promise((answer) => this.asked.push({ task, change, answer }))

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

/** Time that passes only when the test says. */
class FakeScheduler implements Scheduler {
  #now: Ms = 0
  #waiting: { at: Ms; run: () => void }[] = []

  readonly after = (wait: Ms, run: () => void): (() => void) => {
    const entry = { at: this.#now + wait, run }
    this.#waiting.push(entry)
    return () => {
      this.#waiting = this.#waiting.filter((waiting) => waiting !== entry)
    }
  }

  advance(time: Ms): void {
    this.#now += time
    const due = this.#waiting.filter(({ at }) => at <= this.#now)
    this.#waiting = this.#waiting.filter(({ at }) => at > this.#now)
    for (const { run } of due) run()
  }
}

const makeListSessionService = (): {
  changes: FakeTaskChanges
  scheduler: FakeScheduler
  session: ListSessionService
} => {
  const changes = new FakeTaskChanges()
  const scheduler = new FakeScheduler()
  return { changes, scheduler, session: new ListSessionService(changes, scheduler) }
}

describe("ListSessionService", () => {
  it("shows a tick at once, keeps the task in place once it's done, and offers to undo it", async () => {
    const { changes, session } = makeListSessionService()
    const task = makeTask()
    const ticking = session.toggle(task)
    expect(isShownDone(session.state, task)).toBe(true)
    expect(isCelebrated(session.state, task.id)).toBe(true)
    expect(session.state.undoable).toBeUndefined()

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

  it("undoes a tick, which reopens the task", async () => {
    const { changes, session } = makeListSessionService()
    const task = makeTask()
    const ticking = session.toggle(task)
    await changes.answer()
    await ticking

    const undoing = session.undo()
    expect(session.state.undoable).toBeUndefined()
    expect(isShownDone(session.state, task)).toBe(false)
    expect(changes.asked[0]?.change).toEqual({ type: TaskChangeType.STATUS, request: { status: TaskStatus.OPEN } })
    await changes.answer()
    await undoing
    expect(session.state.ticked[task.id]).toBeUndefined()
    expect(isShownDone(session.state, task)).toBe(false)
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
})
