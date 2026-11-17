import { describe, expect, it } from "vite-plus/test"
import {
  FocusTarget,
  SEQUENCE_MS,
  ShortcutGroup,
  ShortcutScope,
  ShortcutService,
  type Shortcut
} from "./shortcut-service.ts"
import type { ShortcutSettingsStore } from "./shortcut-settings.ts"
import { FakeScheduler } from "../test-support/fake-scheduler.ts"
import { testTelemetry, type TestTelemetry } from "../test-support/test-telemetry.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"

class FakeSettings implements ShortcutSettingsStore {
  constructor(public singleKeys = true) {}
  readonly loadSingleKeys = (): boolean => this.singleKeys
  readonly saveSingleKeys = (on: boolean): void => {
    this.singleKeys = on
  }
}

interface Setup {
  scheduler: FakeScheduler
  settings: FakeSettings
  shortcuts: ShortcutService
  telemetry: TestTelemetry
  /** What the shortcuts did, in order. */
  ran: string[]
  /** A shortcut that records its name when it runs. */
  shortcut: (keys: string, name: string, group?: ShortcutGroup) => Shortcut
}

const makeShortcutService = (settings = new FakeSettings()): Setup => {
  const scheduler = new FakeScheduler()
  const ran: string[] = []
  const telemetry = testTelemetry()
  return {
    scheduler,
    settings,
    ran,
    telemetry,
    shortcuts: new ShortcutService(scheduler, settings, telemetry.analytics),
    shortcut: (keys, name, group = ShortcutGroup.GENERAL) => ({
      keys: keys.split(" "),
      description: name,
      group,
      run: () => {
        ran.push(name)
      }
    })
  }
}

describe("ShortcutService", () => {
  it("runs a shortcut's key, and leaves other keys to the browser", () => {
    const { shortcuts, shortcut, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [shortcut("c", "capture")])
    expect(shortcuts.press("c")).toBe(true)
    expect(shortcuts.press("x")).toBe(false)
    expect(ran).toEqual(["capture"])
  })

  it("tracks the shortcuts used, and opening the list and the menu", () => {
    const { shortcuts, shortcut, scheduler, telemetry } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [
      shortcut("c", "capture"),
      shortcut("g h", "home"),
      shortcut("g h o", "hobbies")
    ])
    shortcuts.press("c")
    shortcuts.press("g")
    shortcuts.press("h")
    scheduler.advance(SEQUENCE_MS)
    shortcuts.openHelp()
    shortcuts.closeHelp()
    shortcuts.openMenu()
    expect(telemetry.tracked()).toEqual([
      [ANALYTICS_CODES.shortcut.used, { keys: "c", description: "capture" }],
      [ANALYTICS_CODES.shortcut.used, { keys: "g h", description: "home" }],
      [ANALYTICS_CODES.shortcutsHelp.opened, {}],
      [ANALYTICS_CODES.commandMenu.opened, {}]
    ])
  })

  it("runs a sequence of keys pressed in turn", () => {
    const { shortcuts, shortcut, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [shortcut("g i", "inbox"), shortcut("c", "capture")])
    expect(shortcuts.press("g")).toBe(true)
    expect(ran).toEqual([])
    expect(shortcuts.press("i")).toBe(true)
    expect(ran).toEqual(["inbox"])
  })

  it("forgets the start of a sequence after a moment", () => {
    const { shortcuts, shortcut, scheduler, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [shortcut("g i", "inbox")])
    shortcuts.press("g")
    scheduler.advance(SEQUENCE_MS)
    expect(shortcuts.press("i")).toBe(false)
    expect(ran).toEqual([])
  })

  it("starts afresh with a key that doesn't go on from the ones before", () => {
    const { shortcuts, shortcut, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [shortcut("g i", "inbox"), shortcut("c", "capture")])
    shortcuts.press("g")
    expect(shortcuts.press("c")).toBe(true)
    expect(ran).toEqual(["capture"])
    expect(shortcuts.press("i")).toBe(false)
  })

  it("waits to see if a sequence goes on, then runs the shorter", () => {
    const { shortcuts, shortcut, scheduler, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [shortcut("g h", "home"), shortcut("g h o", "hobbies")])
    shortcuts.press("g")
    shortcuts.press("h")
    expect(ran).toEqual([])
    scheduler.advance(SEQUENCE_MS)
    expect(ran).toEqual(["home"])

    shortcuts.press("g")
    shortcuts.press("h")
    shortcuts.press("o")
    scheduler.advance(SEQUENCE_MS)
    expect(ran).toEqual(["home", "hobbies"])
  })

  it("prefers a page's shortcut to the app's for the same keys, whichever was set first", () => {
    const { shortcuts, shortcut, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.PAGE, () => [shortcut("c", "capture into the task's domain")])
    const unregister = shortcuts.register(ShortcutScope.APP, () => [shortcut("c", "capture")])
    shortcuts.press("c")
    expect(ran).toEqual(["capture into the task's domain"])
    expect(shortcuts.active().map(({ description }) => description)).toEqual(["capture into the task's domain"])

    unregister()
    expect(shortcuts.active()).toHaveLength(1)
  })

  it("lists the app's shortcuts first, then the page's, each in the order they were set", () => {
    const { shortcuts, shortcut } = makeShortcutService()
    shortcuts.register(ShortcutScope.PAGE, () => [shortcut("s", "status"), shortcut("p", "priority")])
    shortcuts.register(ShortcutScope.PAGE, () => [shortcut("d", "due")])
    shortcuts.register(ShortcutScope.APP, () => [shortcut("c", "capture"), shortcut("?", "help")])
    expect(shortcuts.active().map(({ description }) => description)).toEqual([
      "capture",
      "help",
      "status",
      "priority",
      "due"
    ])
  })

  it("prefers the latest of a page's shortcuts for the same keys", () => {
    const { shortcuts, shortcut, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.PAGE, () => [shortcut("x", "older")])
    shortcuts.register(ShortcutScope.PAGE, () => [shortcut("x", "newer")])
    shortcuts.press("x")
    expect(ran).toEqual(["newer"])
  })

  it("stops using shortcuts taken away", () => {
    const { shortcuts, shortcut } = makeShortcutService()
    const unregister = shortcuts.register(ShortcutScope.PAGE, () => [shortcut("c", "capture")])
    unregister()
    expect(shortcuts.press("c")).toBe(false)
  })

  it("leaves a key to the browser when its shortcut has nothing to do", () => {
    const { shortcuts } = makeShortcutService()
    shortcuts.register(ShortcutScope.PAGE, () => [
      { keys: ["mod+z"], description: "Undo", group: ShortcutGroup.TASKS, run: () => undefined, available: () => false }
    ])
    expect(shortcuts.press("mod+z")).toBe(false)
  })

  it("turns off and on shortcuts that start with a character, remembering the choice, and keeps the rest", () => {
    const { shortcuts, shortcut, settings, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [
      shortcut("c", "capture"),
      shortcut("g i", "inbox"),
      shortcut("mod+z", "undo"),
      shortcut("ArrowDown", "next")
    ])
    shortcuts.setSingleKeys(false)
    expect(settings.singleKeys).toBe(false)
    expect(shortcuts.press("c")).toBe(false)
    expect(shortcuts.press("g")).toBe(false)
    expect(shortcuts.press("mod+z")).toBe(true)
    expect(shortcuts.press("ArrowDown")).toBe(true)
    expect(shortcuts.active().map(({ description }) => description)).toEqual(["undo", "next"])

    shortcuts.setSingleKeys(true)
    shortcuts.press("c")
    expect(ran).toEqual(["undo", "next", "capture"])
  })

  it("starts with single keys as the person last chose", () => {
    const { shortcuts } = makeShortcutService(new FakeSettings(false))
    expect(shortcuts.state.singleKeys).toBe(false)
  })

  it("ignores keys while the command menu is open", () => {
    const { shortcuts, shortcut, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [shortcut("c", "capture")])
    shortcuts.openMenu()
    expect(shortcuts.press("c")).toBe(false)
    shortcuts.closeMenu()
    shortcuts.press("c")
    expect(ran).toEqual(["capture"])
  })

  it("ignores keys while the list of shortcuts is open", () => {
    const { shortcuts, shortcut, ran } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [shortcut("c", "capture")])
    shortcuts.openHelp()
    expect(shortcuts.press("c")).toBe(false)
    shortcuts.closeHelp()
    shortcuts.press("c")
    expect(ran).toEqual(["capture"])
  })

  it("reads each layer's shortcuts afresh at every press", () => {
    const { shortcuts, shortcut, ran } = makeShortcutService()
    let name = "first"
    shortcuts.register(ShortcutScope.APP, () => [shortcut("c", name)])
    shortcuts.press("c")
    name = "second"
    shortcuts.press("c")
    expect(ran).toEqual(["first", "second"])
  })

  it("holds a request for focus until it's taken", () => {
    const { shortcuts } = makeShortcutService()
    shortcuts.requestFocus(FocusTarget.CAPTURE)
    expect(shortcuts.state.focusRequest).toBe(FocusTarget.CAPTURE)
    shortcuts.focusTaken()
    expect(shortcuts.state.focusRequest).toBeUndefined()
  })

  it("stops waiting for a sequence when it goes", () => {
    const { shortcuts, shortcut, scheduler } = makeShortcutService()
    shortcuts.register(ShortcutScope.APP, () => [shortcut("g i", "inbox")])
    shortcuts.press("g")
    shortcuts.dispose()
    expect(scheduler.waiting).toBe(0)
  })
})
