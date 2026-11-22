import { normaliseNotes } from "./notes-markdown.ts"
import { NotesMode, type NotesModeStore } from "./notes-mode.ts"
import { AbstractService } from "../services/abstract-service.ts"
import type { Analytics } from "../telemetry/analytics.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"

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
  readonly #analytics: Analytics
  /** The draft when the person went into the notes, to tell whether they wrote anything. */
  #draftOnEntering = ""

  constructor(notes: string, save: (notes: string) => void, modes: NotesModeStore, analytics: Analytics) {
    const saved = normaliseNotes(notes)
    super({ mode: modes.load(), saved, draft: saved, source: saved, writing: false, shown: { notes: saved } })
    this.#save = save
    this.#modes = modes
    this.#analytics = analytics
  }

  readonly startWriting = (): void => {
    this.#draftOnEntering = this.state.draft
    this.setState({ writing: true })
  }

  readonly finishWriting = (): void => {
    const { draft, saved, mode } = this.state
    this.setState({ writing: false })
    if (draft === this.#draftOnEntering && draft !== saved) {
      // Nothing written, so a change received meanwhile isn't overwritten: it's shown.
      this.setState({ draft: saved, source: saved, shown: { notes: saved } })
      return
    }
    this.#saveDraft()
    if (mode === NotesMode.MARKDOWN) this.setState({ source: this.state.draft })
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

  /** A link in the notes has been followed, out of the app. */
  readonly followedLink = (): void =>
    this.#analytics.track(ANALYTICS_CODES.notes.linkFollowed, "followed a link in notes")

  readonly switchMode = (): void => {
    const mode = this.state.mode === NotesMode.RICH ? NotesMode.MARKDOWN : NotesMode.RICH
    if (mode === NotesMode.MARKDOWN) this.setState({ mode, source: this.state.draft })
    else this.setState({ mode, shown: { notes: this.state.draft } })
    this.#modes.save(mode)
    this.#analytics.track(ANALYTICS_CODES.notes.modeSwitched, "switched how notes are written", { mode })
  }

  readonly dispose = (): void => this.#saveDraft()

  #saveDraft(): void {
    const { draft, saved } = this.state
    if (draft === saved) return
    this.setState({ saved: draft })
    this.#save(draft)
  }
}
