import { makeTask } from "@taxa/shared/test-support/make-task"
import type { Task } from "@taxa/shared/tasks/task"
import { describe, expect, it } from "vite-plus/test"
import { listShortcuts } from "./list-shortcuts.ts"
import { ListSessionService } from "./list-session-service.ts"
import { ShortcutScope, ShortcutService } from "../../shortcuts/shortcut-service.ts"
import type { TaskChangesActions } from "../changes/task-changes-service.ts"
import { FakeScheduler } from "../../test-support/fake-scheduler.ts"

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
  left: number[]
} => {
  const toggled: Task[] = []
  const changes: TaskChangesActions = {
    change: (task) => {
      toggled.push(task)
      return Promise.resolve(undefined)
    },
    clearProblems: () => undefined
  }
  const session = new ListSessionService(changes, new FakeScheduler())
  const opened: Task[] = []
  const left: number[] = []
  const shortcuts = new ShortcutService(new FakeScheduler(), {
    loadSingleKeys: () => true,
    saveSingleKeys: () => undefined
  })
  shortcuts.register(ShortcutScope.PAGE, () =>
    listShortcuts(
      listed,
      session,
      (task) => opened.push(task),
      () => left.push(1)
    )
  )
  return { press: shortcuts.press, session, opened, toggled, left }
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

  it("lets go of the list with Escape, which is otherwise left alone", () => {
    const { press, session, left } = setUp()
    expect(press("Escape")).toBe(false)
    press("j")
    expect(press("Escape")).toBe(true)
    expect(session.state.highlighted).toBeUndefined()
    expect(left).toHaveLength(1)
  })

  it("leaves ⌘Z to the browser when there's no tick to undo", () => {
    const { press } = setUp()
    expect(press("mod+z")).toBe(false)
  })
})
