/** How notes are written: formatted as you type, or as Markdown source. */
export enum NotesMode {
  RICH = "RICH",
  MARKDOWN = "MARKDOWN"
}

const KEY = "taxa.notesMode"

/** Each person's choice, remembered in their browser; formatted unless they chose otherwise. */
export const loadNotesMode = (): NotesMode => {
  try {
    return localStorage.getItem(KEY) === NotesMode.MARKDOWN ? NotesMode.MARKDOWN : NotesMode.RICH
  } catch {
    return NotesMode.RICH
  }
}

export const saveNotesMode = (mode: NotesMode): void => {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // Not remembered, then; it still applies to this page.
  }
}
