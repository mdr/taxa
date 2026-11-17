import { describe, expect, it } from "vite-plus/test"
import { keyLabel, keyName, type KeyPress } from "./key-press.ts"

const press = (key: string, held: Partial<Omit<KeyPress, "key">> = {}): KeyPress => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...held
})

describe("keyName", () => {
  it.each([
    [press("c"), "c"],
    [press("C", { shiftKey: true }), "shift+c"],
    [press("C"), "c"],
    [press("?", { shiftKey: true }), "?"],
    [press("z", { metaKey: true }), "mod+z"],
    [press("z", { ctrlKey: true }), "mod+z"],
    [press("Z", { metaKey: true, shiftKey: true }), "mod+shift+z"],
    [press("Escape"), "Escape"]
  ])("names %o as %s", (given, name) => {
    expect(keyName(given)).toBe(name)
  })

  it("ignores lone modifiers, and presses with Alt", () => {
    expect(keyName(press("Shift", { shiftKey: true }))).toBeUndefined()
    expect(keyName(press("Meta", { metaKey: true }))).toBeUndefined()
    expect(keyName(press("©", { altKey: true }))).toBeUndefined()
  })
})

describe("keyLabel", () => {
  it.each([
    ["g", true, "G"],
    ["?", true, "?"],
    ["mod+z", true, "⌘Z"],
    ["mod+z", false, "Ctrl+Z"],
    ["mod+shift+z", true, "⌘⇧Z"],
    ["shift+c", false, "Shift+C"],
    ["Escape", true, "Esc"],
    ["ArrowDown", true, "↓"],
    ["ArrowUp", false, "↑"]
  ])("writes %s (Mac %s) as %s", (name, mac, label) => {
    expect(keyLabel(name, mac)).toBe(label)
  })
})
