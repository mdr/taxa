import { MENU_KEY } from "./command-menu-service.ts"
import { SESSION_PATH } from "../sessions/session-paths.ts"
import { IN_PROGRESS_PATH } from "../tasks/in-progress.ts"
import { BIN_PATH } from "../tasks/bin/bin-path.ts"
import { DEADLINES_PATH } from "../deadlines/deadlines.ts"
import { PLAN_TODAY_PATH, SOMEDAY_PATH, SOON_PATH, TODAY_PATH } from "../tasks/when/when-paths.ts"
import type { UndoActions } from "../undo/undo-service.ts"
import { FocusTarget, ShortcutGroup, type Shortcut, type ShortcutActions } from "./shortcut-service.ts"

/**
 * `G` then a letter: the lists used every day. Not domains, since people tend
 * to stay in one; those are in the command menu.
 */
const GO_TO: readonly { key: string; description: string; path: string }[] = [
  { key: "t", description: "Today", path: TODAY_PATH },
  { key: "s", description: "Soon", path: SOON_PATH },
  { key: "d", description: "Deadlines", path: DEADLINES_PATH },
  { key: "i", description: "Inbox", path: "/" },
  { key: "p", description: "In progress", path: IN_PROGRESS_PATH },
  { key: "n", description: "Session", path: SESSION_PATH },
  { key: "m", description: "Someday", path: SOMEDAY_PATH },
  { key: "b", description: "Bin", path: BIN_PATH }
]

/** Pages with quick capture at the top: lists tasks live in, and the views of what's for today, soon or someday. */
const CAPTURES_ON = new Set(["/", TODAY_PATH, PLAN_TODAY_PATH, SOON_PATH, SOMEDAY_PATH])

const hasCapture = (location: string): boolean => CAPTURES_ON.has(location) || location.startsWith("/domains/")

/** The shortcuts on every page, given where you are and how to go elsewhere. */
export const appShortcuts = (
  location: string,
  navigate: (to: string) => void,
  shortcuts: Pick<ShortcutActions, "openHelp" | "openMenu" | "requestFocus">,
  history: Pick<UndoActions, "undo" | "redo">
): readonly Shortcut[] => [
  {
    keys: ["c"],
    description: "Add a task",
    group: ShortcutGroup.GENERAL,
    run: () => {
      if (!hasCapture(location)) navigate("/")
      shortcuts.requestFocus(FocusTarget.CAPTURE)
    }
  },
  { keys: ["?"], description: "Show keyboard shortcuts", group: ShortcutGroup.GENERAL, run: shortcuts.openHelp },
  { keys: [MENU_KEY], description: "Find a command or task", group: ShortcutGroup.GENERAL, run: shortcuts.openMenu },
  {
    keys: ["mod+z"],
    description: "Undo the last change",
    group: ShortcutGroup.GENERAL,
    run: () => void history.undo()
  },
  {
    keys: ["mod+shift+z"],
    description: "Redo what was undone",
    group: ShortcutGroup.GENERAL,
    run: () => void history.redo()
  },
  ...GO_TO.map(({ key, description, path }): Shortcut => ({
    keys: ["g", key],
    description,
    group: ShortcutGroup.GO,
    run: () => navigate(path)
  }))
]
