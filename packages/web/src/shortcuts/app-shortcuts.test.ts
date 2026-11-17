import { domainPrefix } from "@taxa/shared/domains/domain"
import { describe, expect, it } from "vite-plus/test"
import { appShortcuts } from "./app-shortcuts.ts"
import { FocusTarget, type Shortcut } from "./shortcut-service.ts"

const domains = [
  { name: "Home", prefix: domainPrefix("H") },
  { name: "Work", prefix: domainPrefix("WK") }
]

const setUp = (
  location: string
): { went: string[]; focused: FocusTarget[]; helped: number[]; shortcuts: readonly Shortcut[] } => {
  const went: string[] = []
  const focused: FocusTarget[] = []
  const helped: number[] = []
  const shortcuts = appShortcuts(location, (to) => went.push(to), domains, {
    openHelp: () => helped.push(1),
    requestFocus: (target) => focused.push(target)
  })
  return { went, focused, helped, shortcuts }
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

  it("adds a task in the Inbox from a page with no list", () => {
    const { went, focused, shortcuts } = setUp("/somewhere")
    run(shortcuts, "c")
    expect(went).toEqual(["/"])
    expect(focused).toEqual([FocusTarget.CAPTURE])
  })

  it("goes to the Inbox, or to a domain by its prefix", () => {
    const { went, shortcuts } = setUp("/")
    run(shortcuts, "g i")
    run(shortcuts, "g h")
    run(shortcuts, "g w k")
    expect(went).toEqual(["/", "/domains/H", "/domains/WK"])
  })

  it("shows the shortcuts", () => {
    const { helped, shortcuts } = setUp("/")
    run(shortcuts, "?")
    expect(helped).toHaveLength(1)
  })
})
