import { TaskRefSchema } from "@taxa/shared/tasks/task-ref"
import { GROUP_TEXT } from "./shortcut-list.ts"
import { ShortcutGroup, type Shortcut } from "./shortcut-service.ts"
import { AbstractService } from "../services/abstract-service.ts"
import type { Analytics } from "../telemetry/analytics.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"

/** Something the menu offers: a shortcut's action, or opening a task by its ref. */
export interface Command {
  description: string
  group: ShortcutGroup
  /** The shortcut that does it, to learn for next time. */
  keys: readonly string[] | undefined
  run: () => void
}

/** The shortcuts that would do something now, once each, as commands. */
export const menuCommands = (shortcuts: readonly Shortcut[]): Command[] => {
  const seen = new Set<string>()
  return shortcuts
    .filter((shortcut) => shortcut.available?.() !== false && shortcut.keys.join(" ") !== MENU_KEY)
    .filter(({ description }) => {
      if (seen.has(description)) return false
      seen.add(description)
      return true
    })
    .map(({ description, group, keys, run }) => ({ description, group, keys, run }))
}

/** The key that opens the menu. */
export const MENU_KEY = "mod+k"

/**
 * The commands whose words contain every word typed, those that start with
 * what was typed first; and opening a task when a ref is typed.
 */
export const matchCommands = (
  commands: readonly Command[],
  query: string,
  openTask: (ref: string) => void
): Command[] => {
  const typed = query.trim().toLowerCase()
  const ref = TaskRefSchema.safeParse(typed.toUpperCase())
  const opening: Command[] = ref.success
    ? [{ description: `Open ${ref.data}`, group: ShortcutGroup.GO, keys: undefined, run: () => openTask(ref.data) }]
    : []
  const words = typed.split(/\s+/).filter((word) => word !== "")
  const matching = commands.filter((command) => {
    const text = `${GROUP_TEXT[command.group]} ${command.description}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
  const first = matching.filter(({ description }) => description.toLowerCase().startsWith(typed))
  return [...opening, ...first, ...matching.filter((command) => !first.includes(command))]
}

export interface CommandMenuState {
  query: string
  /** Which of the matches Enter would run. */
  selected: number
}

/** One opening of the command menu: what's typed, and which command is picked. */
export class CommandMenuService extends AbstractService<CommandMenuState> {
  readonly #commands: readonly Command[]
  readonly #openTask: (ref: string) => void
  readonly #analytics: Analytics

  constructor(commands: readonly Command[], openTask: (ref: string) => void, analytics: Analytics) {
    super({ query: "", selected: 0 })
    this.#commands = commands
    this.#openTask = openTask
    this.#analytics = analytics
  }

  /** Runs a command from the menu. */
  readonly run = (command: Command): void => {
    this.#analytics.track(ANALYTICS_CODES.commandMenu.commandRun, "ran a command from the menu", {
      description: command.description
    })
    command.run()
  }

  /** What the menu lists for what's typed. */
  readonly matches = (query: string): Command[] => matchCommands(this.#commands, query, this.#openTask)

  readonly type = (query: string): void => this.setState({ query, selected: 0 })

  /** Moves the pick down (1) or up (-1), round from one end to the other. */
  readonly move = (step: 1 | -1): void => {
    const count = this.matches(this.state.query).length
    if (count === 0) return
    this.setState({ selected: (this.state.selected + step + count) % count })
  }

  readonly select = (index: number): void => this.setState({ selected: index })

  /** The command picked, if anything matches. */
  readonly chosen = (): Command | undefined => this.matches(this.state.query)[this.state.selected]
}
