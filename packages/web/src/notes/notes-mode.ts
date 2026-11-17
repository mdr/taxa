/** How notes are written: formatted as you type, or as Markdown source. */
export enum NotesMode {
  RICH = "RICH",
  MARKDOWN = "MARKDOWN"
}

/** Where each person's choice of mode is remembered. */
export interface NotesModeStore {
  load: () => NotesMode
  save: (mode: NotesMode) => void
}

const KEY = "taxa.notesMode"

/** In their browser; formatted unless they chose otherwise. */
export const localNotesModeStore: NotesModeStore = {
  load: () => {
    try {
      return localStorage.getItem(KEY) === NotesMode.MARKDOWN ? NotesMode.MARKDOWN : NotesMode.RICH
    } catch {
      return NotesMode.RICH
    }
  },
  save: (mode) => {
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      // Not remembered, then; it still applies to this page.
    }
  }
}
