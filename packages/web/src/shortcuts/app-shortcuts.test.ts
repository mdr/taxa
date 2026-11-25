import { describe, expect, it } from "vite-plus/test"
import { appShortcuts } from "./app-shortcuts.ts"
import { FocusTarget, type Shortcut } from "./shortcut-service.ts"

const setUp = (
  location: string
): {
  went: string[]
  focused: FocusTarget[]
  helped: number[]
  history: string[]
  shortcuts: readonly Shortcut[]
} => {
  const went: string[] = []
  const focused: FocusTarget[] = []
  const helped: number[] = []
  const history: string[] = []
  const shortcuts = appShortcuts(
    location,
    (to) => went.push(to),
    {
      openHelp: () => helped.push(1),
      openMenu: () => helped.push(2),
      requestFocus: (target) => focused.push(target)
    },
    { undo: () => Promise.resolve(void history.push("undo")), redo: () => Promise.resolve(void history.push("redo")) }
  )
  return { went, focused, helped, history, shortcuts }
}

const run = (shortcuts: readonly Shortcut[], keys: string): void => {
  shortcuts.find((shortcut) => shortcut.keys.join(" ") === keys)?.run()
}

describe("appShortcuts", () => {
  it("adds a task in the list you're on", () => {
    const { went, focused, shortcuts } = setUp("/domains/WK")
    run(shortcuts, "c")
    expect(went).toEqual([])
    expect(focused).toEqual([FocusTarget.CAPTURE])
  })

  it("adds a task for today or soon from those views, and while planning today", () => {
    for (const location of ["/today", "/today/plan", "/soon"]) {
      const { went, focused, shortcuts } = setUp(location)
      run(shortcuts, "c")
      expect(went).toEqual([])
      expect(focused).toEqual([FocusTarget.CAPTURE])
    }
  })

  it("adds a task in the Inbox from a page with no list", () => {
    const { went, focused, shortcuts } = setUp("/somewhere")
    run(shortcuts, "c")
    expect(went).toEqual(["/"])
    expect(focused).toEqual([FocusTarget.CAPTURE])
  })

  it("goes to each list used every day, but not to domains", () => {
    const { went, shortcuts } = setUp("/")
    for (const keys of ["g t", "g s", "g i", "g p", "g n", "g m", "g b", "g h"]) run(shortcuts, keys)
    expect(went).toEqual(["/today", "/soon", "/", "/in-progress", "/session", "/someday", "/bin"])
  })

  it("shows the shortcuts, and the command menu", () => {
    const { helped, shortcuts } = setUp("/")
    run(shortcuts, "?")
    run(shortcuts, "mod+k")
    expect(helped).toEqual([1, 2])
  })

  it("undoes and redoes the last change, anywhere", () => {
    const { history, shortcuts } = setUp("/somewhere")
    run(shortcuts, "mod+z")
    run(shortcuts, "mod+shift+z")
    expect(history).toEqual(["undo", "redo"])
  })
})
