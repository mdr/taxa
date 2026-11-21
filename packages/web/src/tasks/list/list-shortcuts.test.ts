import { makeTask } from "@taxa/shared/test-support/make-task"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { describe, expect, it } from "vite-plus/test"
import { listShortcuts } from "./list-shortcuts.ts"
import { RowMenuEntry } from "./row/row-menu-entry.ts"
import { ListSessionService } from "./list-session-service.ts"
import { ShortcutScope, ShortcutService } from "../../shortcuts/shortcut-service.ts"
import { TaskChangeType, type TaskChange, type TaskChangesActions } from "../changes/task-changes-service.ts"
import { FakeScheduler } from "../../test-support/fake-scheduler.ts"
import { testTelemetry } from "../../test-support/test-telemetry.ts"

const first = makeTask({ number: 1, title: "Fix the tap" })
const second = makeTask({ number: 2, title: "Bleed the radiators" })

/** The list's keys, pressed through a real shortcut service, on a session whose changes go nowhere. */
const setUp = (
  listed: readonly Task[] = [first, second]
): {
  press: (key: string) => boolean
  session: ListSessionService
  opened: Task[]
  toggled: Task[]
  made: TaskChange[]
  left: number[]
  found: number[]
  followedOn: Task[]
  removed: Task[]
} => {
  const followedOn: Task[] = []
  const removed: Task[] = []
  const toggled: Task[] = []
  const made: TaskChange[] = []
  const changes: TaskChangesActions = {
    change: (task, change) => {
      toggled.push(task)
      made.push(change)
      return Promise.resolve(undefined)
    },
    clearProblems: () => undefined
  }
  const session = new ListSessionService(changes, new FakeScheduler(), testTelemetry().analytics)
  const opened: Task[] = []
  const left: number[] = []
  const found: number[] = []
  const shortcuts = new ShortcutService(
    new FakeScheduler(),
    { loadSingleKeys: () => true, saveSingleKeys: () => undefined },
    testTelemetry().analytics
  )
  shortcuts.register(ShortcutScope.PAGE, () =>
    listShortcuts(
      listed,
      session,
      {
        open: (task) => opened.push(task),
        followOn: (task) => followedOn.push(task),
        remove: (task) => removed.push(task),
        filedFromRow: (task) => task.inbox
      },
      () => left.push(1),
      () => found.push(1)
    )
  )
  return { press: shortcuts.press, session, opened, toggled, made, left, found, followedOn, removed }
}

describe("listShortcuts", () => {
  it("moves through the tasks with J and K, or the arrows", () => {
    const { press, session } = setUp()
    press("j")
    expect(session.state.highlighted).toBe(first.id)
    press("ArrowDown")
    expect(session.state.highlighted).toBe(second.id)
    press("k")
    press("ArrowUp")
    expect(session.state.highlighted).toBe(first.id)
  })

  it("leaves the arrows to the page when there's nothing listed", () => {
    const { press } = setUp([])
    expect(press("ArrowDown")).toBe(false)
  })

  it("opens and ticks off the highlighted task, and only when there is one", () => {
    const { press, opened, toggled } = setUp()
    expect(press("Enter")).toBe(false)
    expect(press("x")).toBe(false)
    press("j")
    press("j")
    press("Enter")
    press("x")
    expect(opened).toEqual([second])
    expect(toggled).toEqual([second])
  })

  it("starts and stops the highlighted task with I, but not a finished one", () => {
    const done = makeTask({ number: 3, status: TaskStatus.DONE })
    const started = makeTask({ number: 4, status: TaskStatus.IN_PROGRESS })
    const { press, made } = setUp([first, done, started])
    expect(press("i")).toBe(false)
    press("j")
    press("i")
    press("j")
    expect(press("i")).toBe(false)
    press("j")
    press("i")
    expect(made).toEqual([
      { type: TaskChangeType.STATUS, request: { status: TaskStatus.IN_PROGRESS } },
      { type: TaskChangeType.STATUS, request: { status: TaskStatus.OPEN } }
    ])
  })

  it("lets go of the list with Escape, which is otherwise left alone", () => {
    const { press, session, left } = setUp()
    expect(press("Escape")).toBe(false)
    press("j")
    expect(press("Escape")).toBe(true)
    expect(session.state.highlighted).toBeUndefined()
    expect(left).toHaveLength(1)
  })

  it("goes to the search box with /", () => {
    const { press, found } = setUp()
    press("/")
    expect(found).toEqual([1])
  })

  it("leaves ⌘Z to the browser when there's no tick to undo", () => {
    const { press } = setUp()
    expect(press("mod+z")).toBe(false)
  })

  it("opens the highlighted task's menu at what the task page's keys change, or whole with .", () => {
    const { press, session } = setUp()
    expect(press("s")).toBe(false)
    press("j")
    press("s")
    expect(session.state.opening).toEqual({ taskId: first.id, entry: RowMenuEntry.STATUS, seq: 1 })
    press("l")
    expect(session.state.opening).toEqual({ taskId: first.id, entry: RowMenuEntry.TAGS, seq: 2 })
    press(".")
    expect(session.state.opening?.entry).toBe(RowMenuEntry.MENU)
  })

  it("files an Inbox task with M from its own chip, and moves any other from its menu", () => {
    const inbox = makeTask({ number: 3, title: "Renew passport", inbox: true })
    const { press, session } = setUp([inbox, first])
    press("j")
    press("m")
    expect(session.state.opening?.entry).toBe(RowMenuEntry.FILE)
    press("j")
    press("m")
    expect(session.state.opening?.entry).toBe(RowMenuEntry.MOVE)
  })

  it("adds a follow-on to the highlighted task, and deletes it", () => {
    const { press, followedOn, removed } = setUp()
    press("j")
    press("f")
    press("Backspace")
    press("Delete")
    expect(followedOn).toEqual([first])
    expect(removed).toEqual([first, first])
  })
})
