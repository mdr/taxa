/** Where each person's choice about single-key shortcuts is remembered. */
export interface ShortcutSettingsStore {
  loadSingleKeys: () => boolean
  saveSingleKeys: (on: boolean) => void
}

const KEY = "taxa.singleKeyShortcuts"

/** In their browser; on unless they turned them off. */
export const localShortcutSettings: ShortcutSettingsStore = {
  loadSingleKeys: () => {
    try {
      return localStorage.getItem(KEY) !== "off"
    } catch {
      return true
    }
  },
  saveSingleKeys: (on) => {
    try {
      localStorage.setItem(KEY, on ? "on" : "off")
    } catch {
      // Not remembered, then; it still applies to this page.
    }
  }
}
