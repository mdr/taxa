import type { Task } from "@taxa/shared/tasks/task"
import { Step, type ListSessionActions, type ListSessionState } from "./list-session-service.ts"
import { ShortcutGroup, type Shortcut } from "../../shortcuts/shortcut-service.ts"
import { START_OR_STOP, startedOrStopped } from "../in-progress.ts"

type Session = Pick<ListSessionActions, "moveHighlight" | "highlight" | "toggle" | "startOrStop" | "undo"> & {
  readonly state: Pick<ListSessionState, "highlighted" | "undoable">
}

/** The keys for a list, given the tasks it shows in order, its session, how to open a task, leave the list, and search it. */
export const listShortcuts = (
  listed: readonly Task[],
  session: Session,
  open: (task: Task) => void,
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
