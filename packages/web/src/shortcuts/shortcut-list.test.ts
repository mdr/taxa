import { describe, expect, it } from "vite-plus/test"
import { shortcutEntries } from "./shortcut-list.ts"
import { ShortcutGroup, type Shortcut } from "./shortcut-service.ts"

const shortcut = (keys: string, description: string, group = ShortcutGroup.TASKS): Shortcut => ({
  keys: keys.split(" "),
  description,
  group,
  run: () => undefined
})

describe("shortcutEntries", () => {
  it("gathers the ways of doing each thing, in order, from one group", () => {
    const shortcuts = [
      shortcut("j", "Next task"),
      shortcut("c", "Add a task", ShortcutGroup.GENERAL),
      shortcut("k", "Previous task"),
      shortcut("ArrowDown", "Next task")
    ]
    expect(shortcutEntries(shortcuts, ShortcutGroup.TASKS)).toEqual([
      { description: "Next task", ways: [["j"], ["ArrowDown"]] },
      { description: "Previous task", ways: [["k"]] }
    ])
  })
})
