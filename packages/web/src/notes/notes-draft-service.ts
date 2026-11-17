import { normaliseNotes } from "./notes-markdown.ts"
import { NotesMode, type NotesModeStore } from "./notes-mode.ts"
import { AbstractService } from "../services/abstract-service.ts"

/** Notes for the formatted editor to show in place of what it has: a new object each time. */
interface ShownNotes {
  notes: string
}

export interface NotesDraftState {
  mode: NotesMode
  /** The notes as last saved or received, normalised. */
  saved: string
  /** The notes as now written, normalised. */
  draft: string
  /** The Markdown field's text, as typed. */
  source: string
  /** Whether the person is in the notes, so changes from elsewhere wait. */
  writing: boolean
  shown: ShownNotes
}

interface NotesDraftActions {
  startWriting: () => void
  /** Saves what was written, on leaving the notes. */
  finishWriting: () => void
  /** The formatted editor's notes, as Markdown. */
  write: (notes: string) => void
  /** The Markdown field's text. */
  writeSource: (text: string) => void
  /** The notes as the server now has them. */
  receive: (notes: string) => void
  switchMode: () => void
  /** Saves what was written, on leaving the page. */
  dispose: () => void
}

/**
 * One task's notes being written: saved as Markdown when you leave them, and
 * only if they changed, so opening notes an agent wrote never rewrites them.
 */
export class NotesDraftService extends AbstractService<NotesDraftState> implements NotesDraftActions {
  readonly #save: (notes: string) => void
  readonly #modes: NotesModeStore

  constructor(notes: string, save: (notes: string) => void, modes: NotesModeStore) {
    const saved = normaliseNotes(notes)
    super({ mode: modes.load(), saved, draft: saved, source: saved, writing: false, shown: { notes: saved } })
    this.#save = save
    this.#modes = modes
  }

  readonly startWriting = (): void => this.setState({ writing: true })

  readonly finishWriting = (): void => {
    this.setState({ writing: false })
    this.#saveDraft()
    if (this.state.mode === NotesMode.MARKDOWN) this.setState({ source: this.state.draft })
  }

  readonly write = (notes: string): void => {
    this.setState({ draft: notes })
    // Ticking a checklist item doesn't put you in the notes, so there's no leaving to wait for.
    if (!this.state.writing) this.#saveDraft()
  }

  readonly writeSource = (text: string): void => this.setState({ source: text, draft: normaliseNotes(text) })

  readonly receive = (notes: string): void => {
    const incoming = normaliseNotes(notes)
    if (incoming === this.state.saved) return
    this.setState({ saved: incoming })
    if (this.state.writing) return
    this.setState({ draft: incoming, source: incoming, shown: { notes: incoming } })
  }

  readonly switchMode = (): void => {
    const mode = this.state.mode === NotesMode.RICH ? NotesMode.MARKDOWN : NotesMode.RICH
    if (mode === NotesMode.MARKDOWN) this.setState({ mode, source: this.state.draft })
    else this.setState({ mode, shown: { notes: this.state.draft } })
    this.#modes.save(mode)
  }

  readonly dispose = (): void => this.#saveDraft()

  #saveDraft(): void {
    const { draft, saved } = this.state
    if (draft === saved) return
    this.setState({ saved: draft })
    this.#save(draft)
  }
}
