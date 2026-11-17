import type { Task } from "@taxa/shared/tasks/task"
import { Step, type ListSessionActions, type ListSessionState } from "./list-session-service.ts"
import { ShortcutGroup, type Shortcut } from "../../shortcuts/shortcut-service.ts"

type Session = Pick<ListSessionActions, "moveHighlight" | "highlight" | "toggle" | "undo"> & {
  readonly state: Pick<ListSessionState, "highlighted" | "undoable">
}

/** The keys for a list, given the tasks it shows in order, its session, and how to open a task. */
export const listShortcuts = (
  listed: readonly Task[],
  session: Session,
  open: (task: Task) => void,
  leave: () => void
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
  return [
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
      description: "Undo ticking a task off",
      group: ShortcutGroup.TASKS,
      available: () => session.state.undoable !== undefined,
      run: () => void session.undo()
    }
  ]
}
