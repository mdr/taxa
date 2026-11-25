import { domainPrefix } from "@taxa/shared/domains/domain"
import { describe, expect, it } from "vite-plus/test"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import {
  CommandMenuService,
  matchCommands,
  domainCommands,
  menuCommands,
  MOST_FOUND,
  SEARCH_PAUSE_MS,
  type Command
} from "./command-menu-service.ts"
import { FakeScheduler } from "../test-support/fake-scheduler.ts"
import { ShortcutGroup, type Shortcut } from "./shortcut-service.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"
import { testTelemetry, type TestTelemetry } from "../test-support/test-telemetry.ts"

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

describe("domainCommands", () => {
  it("goes to each domain, with no keys", () => {
    const went: string[] = []
    const [home] = domainCommands([{ name: "Home", prefix: domainPrefix("H") }], (to) => went.push(to))
    expect(home && [home.description, home.group, home.keys]).toEqual(["Home", ShortcutGroup.GO, undefined])
    home?.run()
    expect(went).toEqual(["/domains/H"])
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
  it("runs a command, tracking which", () => {
    const telemetry = testTelemetry()
    const ran: string[] = []
    const menu = new CommandMenuService([], () => undefined, telemetry.analytics)
    menu.run({ description: "Home", group: ShortcutGroup.GO, keys: ["g", "h"], run: () => ran.push("home") })
    expect(ran).toEqual(["home"])
    expect(telemetry.tracked()).toEqual([[ANALYTICS_CODES.commandMenu.commandRun, { description: "Home" }]])
  })

  it("picks the first match as you type, and moves the pick round the matches", () => {
    const menu = new CommandMenuService(commands, () => undefined, testTelemetry().analytics)
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
    const menu = new CommandMenuService(commands, () => undefined, testTelemetry().analytics)
    menu.type("zebra")
    menu.move(1)
    expect(menu.chosen()).toBeUndefined()
  })

  it("picks a command pointed at", () => {
    const menu = new CommandMenuService(commands, () => undefined, testTelemetry().analytics)
    menu.select(3)
    expect(menu.chosen()?.description).toBe("Set priority")
  })

  describe("finding tasks", () => {
    const tap = makeTask({ number: 1, title: "Fix the kitchen tap" })
    const washer = makeTask({ number: 2, title: "Buy a tap washer", status: TaskStatus.DONE })

    /** A menu whose server answers each search when the test says. */
    const setUp = (): {
      menu: CommandMenuService
      scheduler: FakeScheduler
      asked: { search: string; answer: (tasks: Task[]) => void }[]
      answer: (index: number, tasks: Task[]) => Promise<void>
      opened: string[]
      telemetry: TestTelemetry
    } => {
      const scheduler = new FakeScheduler()
      const asked: { search: string; answer: (tasks: Task[]) => void }[] = []
      const opened: string[] = []
      const telemetry = testTelemetry()
      const menu = new CommandMenuService(commands, (ref) => opened.push(ref), telemetry.analytics, {
        scheduler,
        find: (search) => new Promise((answer) => asked.push({ search, answer }))
      })
      const answer = async (index: number, tasks: Task[]): Promise<void> => {
        asked[index]?.answer(tasks)
        await Promise.resolve()
        await Promise.resolve()
      }
      return { menu, scheduler, asked, answer, opened, telemetry }
    }

    it("lists the tasks found after the commands, once typing pauses, and opens one", async () => {
      const { menu, scheduler, asked, answer, opened, telemetry } = setUp()
      menu.type("t")
      menu.type("ta")
      menu.type("tap ")
      scheduler.advance(SEARCH_PAUSE_MS)
      expect(asked.map(({ search }) => search)).toEqual(["tap"])
      await answer(0, [tap, washer])
      const found = menu.matches(menu.state.query).filter(({ task }) => task)
      expect(descriptions(found)).toEqual(["Fix the kitchen tap", "Buy a tap washer"])
      for (const command of found) menu.run(command)
      expect(opened).toEqual(["H-1", "H-2"])
      expect(telemetry.tracked()).toEqual([
        [ANALYTICS_CODES.commandMenu.taskOpened, {}],
        [ANALYTICS_CODES.commandMenu.taskOpened, {}]
      ])
    })

    it("searches for nothing shorter than two letters", () => {
      const { menu, scheduler, asked } = setUp()
      menu.type(" t ")
      scheduler.advance(SEARCH_PAUSE_MS)
      expect(asked).toEqual([])
    })

    it("ignores an answer for earlier typing, and meanwhile keeps only what's still found", async () => {
      const { menu, scheduler, answer } = setUp()
      menu.type("tap")
      scheduler.advance(SEARCH_PAUSE_MS)
      await answer(0, [tap, washer])
      menu.type("tap wash")
      expect(descriptions(menu.matches(menu.state.query))).toEqual(["Buy a tap washer"])
      scheduler.advance(SEARCH_PAUSE_MS)
      menu.type("tap washer")
      await answer(1, [tap])
      expect(menu.state.found).toEqual([tap, washer])
    })

    it("lists what the server found for what's typed, though it matched something the menu can't see", async () => {
      const { menu, scheduler, answer } = setUp()
      menu.type("thursday")
      scheduler.advance(SEARCH_PAUSE_MS)
      // Found by a comment on it.
      await answer(0, [tap])
      expect(descriptions(menu.matches(menu.state.query).filter(({ task }) => task))).toEqual(["Fix the kitchen tap"])
      menu.type("thursday plumber")
      expect(menu.matches(menu.state.query).filter(({ task }) => task)).toEqual([])
    })

    it("lists only the first few found", async () => {
      const { menu, scheduler, answer } = setUp()
      menu.type("tap")
      scheduler.advance(SEARCH_PAUSE_MS)
      await answer(
        0,
        Array.from({ length: MOST_FOUND + 3 }, (_, index) => makeTask({ title: `Tap ${index}` }))
      )
      expect(menu.state.found).toHaveLength(MOST_FOUND)
    })
  })
})
