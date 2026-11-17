import { describe, expect, it } from "vite-plus/test"
import { CommandMenuService, matchCommands, menuCommands, type Command } from "./command-menu-service.ts"
import { ShortcutGroup, type Shortcut } from "./shortcut-service.ts"

const shortcut = (keys: string, description: string, group: ShortcutGroup, available?: () => boolean): Shortcut => ({
  keys: keys.split(" "),
  description,
  group,
  run: () => undefined,
  ...(available ? { available } : {})
})

const commands: Command[] = menuCommands([
  shortcut("c", "Add a task", ShortcutGroup.GENERAL),
  shortcut("g h", "Home", ShortcutGroup.GO),
  shortcut("g w", "Work", ShortcutGroup.GO),
  shortcut("p", "Set priority", ShortcutGroup.TASKS),
  shortcut("s", "Change status", ShortcutGroup.TASKS)
])

const descriptions = (matched: readonly Command[]): string[] => matched.map(({ description }) => description)

describe("menuCommands", () => {
  it("offers what would do something now, once each, and not the menu itself", () => {
    const offered = menuCommands([
      shortcut("j", "Next task", ShortcutGroup.TASKS),
      shortcut("ArrowDown", "Next task", ShortcutGroup.TASKS),
      shortcut("Enter", "Open the task", ShortcutGroup.TASKS, () => false),
      shortcut("mod+k", "Search commands", ShortcutGroup.GENERAL)
    ])
    expect(offered.map(({ description, keys }) => [description, keys])).toEqual([["Next task", ["j"]]])
  })
})

describe("matchCommands", () => {
  const nowhere = (): void => undefined

  it("offers everything when nothing is typed", () => {
    expect(descriptions(matchCommands(commands, "", nowhere))).toEqual([
      "Add a task",
      "Home",
      "Work",
      "Set priority",
      "Change status"
    ])
  })

  it("finds commands by any of their words, or their group's, in any case", () => {
    expect(descriptions(matchCommands(commands, "PRIO", nowhere))).toEqual(["Set priority"])
    expect(descriptions(matchCommands(commands, "go wor", nowhere))).toEqual(["Work"])
    expect(descriptions(matchCommands(commands, "status change", nowhere))).toEqual(["Change status"])
    expect(descriptions(matchCommands(commands, "zebra", nowhere))).toEqual([])
  })

  it("puts commands that start with what's typed first", () => {
    expect(descriptions(matchCommands(commands, "s", nowhere))).toEqual(["Set priority", "Add a task", "Change status"])
  })

  it("offers to open a task when its ref is typed", () => {
    const opened: string[] = []
    const [first] = matchCommands(commands, " h-12 ", (ref) => opened.push(ref))
    expect(first?.description).toBe("Open H-12")
    first?.run()
    expect(opened).toEqual(["H-12"])
  })
})

describe("CommandMenuService", () => {
  it("picks the first match as you type, and moves the pick round the matches", () => {
    const menu = new CommandMenuService(commands, () => undefined)
    menu.type("go")
    expect(menu.chosen()?.description).toBe("Home")
    menu.move(1)
    expect(menu.chosen()?.description).toBe("Work")
    menu.move(1)
    expect(menu.chosen()?.description).toBe("Home")
    menu.move(-1)
    expect(menu.chosen()?.description).toBe("Work")
    menu.type("status")
    expect(menu.chosen()?.description).toBe("Change status")
  })

  it("picks nothing when nothing matches", () => {
    const menu = new CommandMenuService(commands, () => undefined)
    menu.type("zebra")
    menu.move(1)
    expect(menu.chosen()).toBeUndefined()
  })

  it("picks a command pointed at", () => {
    const menu = new CommandMenuService(commands, () => undefined)
    menu.select(3)
    expect(menu.chosen()?.description).toBe("Set priority")
  })
})
