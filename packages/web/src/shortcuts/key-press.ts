/** What a key press says about itself: a KeyboardEvent has all of these. */
export interface KeyPress {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

const MODIFIERS = new Set(["Shift", "Meta", "Control", "Alt", "CapsLock"])

/**
 * The name shortcuts are written with: `c`, `shift+c`, `?`, `mod+z` (⌘ on
 * a Mac, Ctrl elsewhere). By the character typed, not the key's place, so
 * other layouts work. Undefined for a lone modifier, and with Alt, which
 * types other characters on a Mac.
 */
export const keyName = (press: KeyPress): string | undefined => {
  if (MODIFIERS.has(press.key) || press.altKey) return undefined
  const letter = /^[a-z]$/i.test(press.key)
  const key = letter ? press.key.toLowerCase() : press.key
  const shift = letter && press.shiftKey ? "shift+" : ""
  return `${press.metaKey || press.ctrlKey ? "mod+" : ""}${shift}${key}`
}

const KEY_TEXT: Readonly<Record<string, string>> = {
  ArrowDown: "↓",
  ArrowUp: "↑",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  " ": "Space",
  Enter: "Enter"
}

/** A key as people see it written: `G`, `?`, `↓`, `⌘Z` or `Ctrl+Z`. */
export const keyLabel = (name: string, mac: boolean): string => {
  const parts = name.split("+")
  const key = parts.at(-1) ?? name
  const shown = KEY_TEXT[key] ?? (key.length === 1 ? key.toUpperCase() : key)
  const modifiers = parts.slice(0, -1).map((modifier) => {
    if (modifier === "mod") return mac ? "⌘" : "Ctrl+"
    return mac ? "⇧" : "Shift+"
  })
  return `${modifiers.join("")}${shown}`
}
