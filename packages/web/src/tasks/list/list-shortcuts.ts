import type { Task } from "@taxa/shared/tasks/task"
import { Step, type ListSessionActions, type ListSessionState } from "./list-session-service.ts"
import { ShortcutGroup, type Shortcut } from "../../shortcuts/shortcut-service.ts"
import { START_OR_STOP, startedOrStopped } from "../in-progress.ts"
import { RowMenuEntry } from "./row/row-menu-entry.ts"

type Session = Pick<
  ListSessionActions,
  "moveHighlight" | "highlight" | "toggle" | "startOrStop" | "undo" | "openRowMenu"
> & {
  readonly state: Pick<ListSessionState, "highlighted" | "undoable">
}

/** What a list does with its highlighted task beyond its session, for its keys. */
export interface ListTaskActions {
  open: (task: Task) => void
  /** Starts adding a task that follows on from it. */
  followOn: (task: Task) => void
  /** Deletes it, with a chance to undo it. */
  remove: (task: Task) => void
  /** Whether it's filed from its own chip in the row, as in the Inbox, rather than moved from its menu. */
  filedFromRow: (task: Task) => boolean
}

/** The keys that open a highlighted task's menu at what they change: the task page's keys for the same things. */
const MENU_KEYS: readonly { key: string; description: string; entry: RowMenuEntry }[] = [
  { key: "s", description: "Change status", entry: RowMenuEntry.STATUS },
  { key: "p", description: "Set priority", entry: RowMenuEntry.PRIORITY },
  { key: "w", description: "Choose when", entry: RowMenuEntry.WHEN },
  { key: "d", description: "Set a due date", entry: RowMenuEntry.DUE },
  { key: "e", description: "Estimate", entry: RowMenuEntry.ESTIMATE },
  { key: "m", description: "Move to a domain", entry: RowMenuEntry.MOVE },
  { key: "l", description: "Add a tag", entry: RowMenuEntry.TAGS },
  { key: ".", description: "Open the task's menu", entry: RowMenuEntry.MENU }
]

/** The keys for a list, given the tasks it shows in order, its session, what it does with a task, how to leave it, and search it. */
export const listShortcuts = (
  listed: readonly Task[],
  session: Session,
  { open, followOn, remove, filedFromRow }: ListTaskActions,
  leave: () => void,
  find: () => void
): readonly Shortcut[] => {
  const highlighted = (): Task | undefined => listed.find(({ id }) => id === session.state.highlighted)
  const isHighlighted = (): boolean => highlighted() !== undefined
  const anyListed = (): boolean => listed.length > 0
  const move = (step: Step) => (): void =>
    session.moveHighlight(
      listed.map(({ id }) => id),
      step
    )
  const next = { description: "Next task", group: ShortcutGroup.TASKS, available: anyListed, run: move(Step.NEXT) }
  const previous = {
    description: "Previous task",
    group: ShortcutGroup.TASKS,
    available: anyListed,
    run: move(Step.PREVIOUS)
  }
  const onHighlighted = (description: string, run: (task: Task) => void): Omit<Shortcut, "keys"> => ({
    description,
    group: ShortcutGroup.TASKS,
    available: isHighlighted,
    run: () => {
      const task = highlighted()
      if (task) run(task)
    }
  })
  const removing = onHighlighted("Delete the task", remove)
  return [
    { keys: ["/"], description: "Search the list", group: ShortcutGroup.TASKS, run: find },
    { keys: ["j"], ...next },
    { keys: ["ArrowDown"], ...next },
    { keys: ["k"], ...previous },
    { keys: ["ArrowUp"], ...previous },
    {
      keys: ["Enter"],
      description: "Open the task",
      group: ShortcutGroup.TASKS,
      available: isHighlighted,
      run: () => {
        const task = highlighted()
        if (task) open(task)
      }
    },
    {
      keys: ["x"],
      description: "Tick off, or untick",
      group: ShortcutGroup.TASKS,
      available: isHighlighted,
      run: () => {
        const task = highlighted()
        if (task) void session.toggle(task)
      }
    },
    {
      keys: ["i"],
      description: START_OR_STOP,
      group: ShortcutGroup.TASKS,
      available: () => {
        const task = highlighted()
        return task !== undefined && startedOrStopped(task.status) !== undefined
      },
      run: () => {
        const task = highlighted()
        if (task) void session.startOrStop(task)
      }
    },
    ...MENU_KEYS.map(({ key, description, entry }) => ({
      keys: [key],
      ...onHighlighted(description, (task) =>
        session.openRowMenu(task, entry === RowMenuEntry.MOVE && filedFromRow(task) ? RowMenuEntry.FILE : entry)
      )
    })),
    { keys: ["f"], ...onHighlighted("Add a follow-on task", followOn) },
    { keys: ["Delete"], ...removing },
    { keys: ["Backspace"], ...removing },
    {
      keys: ["Escape"],
      description: "Leave the list",
      group: ShortcutGroup.TASKS,
      available: () => session.state.highlighted !== undefined,
      run: () => {
        session.highlight(undefined)
        leave()
      }
    },
    {
      keys: ["mod+z"],
      description: "Undo ticking off or deleting a task",
      group: ShortcutGroup.TASKS,
      available: () => session.state.undoable !== undefined,
      run: () => void session.undo()
    }
  ]
}
