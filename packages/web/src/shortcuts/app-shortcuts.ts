import type { Domain } from "@taxa/shared/domains/domain"
import { MENU_KEY } from "./command-menu-service.ts"
import { FocusTarget, ShortcutGroup, type Shortcut, type ShortcutActions } from "./shortcut-service.ts"

/** Whether a page shows a list, with quick capture at the top. */
const isList = (location: string): boolean => location === "/" || location.startsWith("/domains/")

/** The shortcuts on every page, given where you are and how to go elsewhere. */
export const appShortcuts = (
  location: string,
  navigate: (to: string) => void,
  domains: readonly Pick<Domain, "name" | "prefix">[],
  shortcuts: Pick<ShortcutActions, "openHelp" | "openMenu" | "requestFocus">
): readonly Shortcut[] => [
  {
    keys: ["c"],
    description: "Add a task",
    group: ShortcutGroup.GENERAL,
    run: () => {
      if (!isList(location)) navigate("/")
      shortcuts.requestFocus(FocusTarget.CAPTURE)
    }
  },
  { keys: ["?"], description: "Show keyboard shortcuts", group: ShortcutGroup.GENERAL, run: shortcuts.openHelp },
  { keys: [MENU_KEY], description: "Search commands", group: ShortcutGroup.GENERAL, run: shortcuts.openMenu },
  { keys: ["g", "i"], description: "Inbox", group: ShortcutGroup.GO, run: () => navigate("/") },
  ...domains.map((domain): Shortcut => ({
    keys: ["g", ...domain.prefix.toLowerCase().split("")],
    description: domain.name,
    group: ShortcutGroup.GO,
    run: () => navigate(`/domains/${domain.prefix}`)
  }))
]
