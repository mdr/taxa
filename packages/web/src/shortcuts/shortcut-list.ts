import type { Shortcut, ShortcutGroup } from "./shortcut-service.ts"

/** One thing shortcuts do, with every way of doing it: `J` or `↓`. */
export interface ShortcutEntry {
  description: string
  ways: (readonly string[])[]
}

/** A group's shortcuts as the list shows them, in the order they were given. */
export const shortcutEntries = (shortcuts: readonly Shortcut[], group: ShortcutGroup): ShortcutEntry[] => {
  const entries = new Map<string, (readonly string[])[]>()
  for (const { description, keys } of shortcuts.filter((shortcut) => shortcut.group === group)) {
    entries.set(description, [...(entries.get(description) ?? []), keys])
  }
  return [...entries].map(([description, ways]) => ({ description, ways }))
}
