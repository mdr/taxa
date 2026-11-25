import type { Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"
import { TaskRefSchema } from "@taxa/shared/tasks/task-ref"
import { matchesSearch } from "@taxa/shared/tasks/task-search"
import type { Ms } from "@taxa/shared/units"
import { GROUP_TEXT } from "./shortcut-list.ts"
import { ShortcutGroup, type Shortcut } from "./shortcut-service.ts"
import { AbstractService } from "../services/abstract-service.ts"
import type { Scheduler } from "../services/scheduler.ts"
import type { Analytics } from "../telemetry/analytics.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"

/** Something the menu offers: a shortcut's action, or opening a task by its ref. */
export interface Command {
  description: string
  group: ShortcutGroup
  /** The shortcut that does it, to learn for next time. */
  keys: readonly string[] | undefined
  run: () => void
  /** The task it opens, for one found by searching. */
  task?: Task
}

/** Finds tasks of any status by words in their titles or notes, best first. */
export type TaskFinder = (search: string) => Promise<Task[]>

/** How long typing pauses before tasks are searched for. */
export const SEARCH_PAUSE_MS: Ms = 150

/** How few letters are too few to search tasks for. */
const SEARCH_MIN_LENGTH = 2

/** How many found tasks the menu lists. */
export const MOST_FOUND = 8

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

/** Going to each domain, which has no shortcut. */
export const domainCommands = (
  domains: readonly Pick<Domain, "name" | "prefix">[],
  navigate: (to: string) => void
): Command[] =>
  domains.map(({ name, prefix }) => ({
    description: name,
    group: ShortcutGroup.GO,
    keys: undefined,
    run: () => navigate(`/domains/${prefix}`)
  }))

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
  /** Tasks found by what was typed, as the server last answered. */
  found: readonly Task[]
  /** What was typed when the server found them. */
  foundFor: string
}

export interface TaskSearch {
  find: TaskFinder
  scheduler: Scheduler
}

/** One opening of the command menu: what's typed, and which command is picked. */
export class CommandMenuService extends AbstractService<CommandMenuState> {
  readonly #commands: readonly Command[]
  readonly #openTask: (ref: string) => void
  readonly #analytics: Analytics
  readonly #search: TaskSearch | undefined
  #cancelSearch: (() => void) | undefined

  constructor(
    commands: readonly Command[],
    openTask: (ref: string) => void,
    analytics: Analytics,
    search?: TaskSearch
  ) {
    super({ query: "", selected: 0, found: [], foundFor: "" })
    this.#commands = commands
    this.#openTask = openTask
    this.#analytics = analytics
    this.#search = search
  }

  /** Runs a command from the menu. */
  readonly run = (command: Command): void => {
    if (command.task)
      // What's in a task is its owner's: track only that one was opened.
      this.#analytics.track(ANALYTICS_CODES.commandMenu.taskOpened, "opened a task found from the menu")
    else
      this.#analytics.track(ANALYTICS_CODES.commandMenu.commandRun, "ran a command from the menu", {
        description: command.description
      })
    command.run()
  }

  /**
   * What the menu lists for what's typed: the commands, then the tasks it
   * finds. Until the server answers for the latest typing, those found for
   * earlier typing that it still finds.
   */
  readonly matches = (query: string): Command[] => [
    ...matchCommands(this.#commands, query, this.#openTask),
    ...(query.trim().length < SEARCH_MIN_LENGTH ? [] : this.state.found)
      // The server's answer for this typing stands: it searches comments too, which the menu can't see.
      .filter((task) => this.state.foundFor === query || matchesSearch(task, query))
      .map((task): Command => ({
        description: task.title,
        group: ShortcutGroup.GO,
        keys: undefined,
        run: () => this.#openTask(task.ref),
        task
      }))
  ]

  readonly type = (query: string): void => {
    this.setState({ query, selected: 0 })
    this.#cancelSearch?.()
    const search = this.#search
    if (!search || query.trim().length < SEARCH_MIN_LENGTH) return
    this.#cancelSearch = search.scheduler.after(SEARCH_PAUSE_MS, () => void this.#find(search.find, query))
  }

  async #find(find: TaskFinder, query: string): Promise<void> {
    const found = await find(query.trim()).catch((): Task[] => [])
    // Typing has gone on since: this answer's for something no longer asked.
    if (query !== this.state.query) return
    this.setState({ found: found.slice(0, MOST_FOUND), foundFor: query })
  }

  readonly dispose = (): void => this.#cancelSearch?.()

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
