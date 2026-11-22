import { describe, expect, it } from "vite-plus/test"
import { NotesDraftService } from "./notes-draft-service.ts"
import { NotesMode, type NotesModeStore } from "./notes-mode.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"
import { testTelemetry, type TestTelemetry } from "../test-support/test-telemetry.ts"

class FakeModeStore implements NotesModeStore {
  constructor(public mode = NotesMode.RICH) {}
  readonly load = (): NotesMode => this.mode
  readonly save = (mode: NotesMode): void => {
    this.mode = mode
  }
}

const makeNotesDraftService = (
  notes = "",
  modes = new FakeModeStore()
): { saves: string[]; modes: FakeModeStore; service: NotesDraftService; telemetry: TestTelemetry } => {
  const saves: string[] = []
  const telemetry = testTelemetry()
  return {
    saves,
    modes,
    telemetry,
    service: new NotesDraftService(notes, (saved) => saves.push(saved), modes, telemetry.analytics)
  }
}

describe("NotesDraftService", () => {
  it("saves what was written on leaving the notes, once", () => {
    const { saves, service } = makeNotesDraftService()
    service.startWriting()
    service.write("Ring the plumber")
    service.write("Ring the plumber first")
    expect(saves).toEqual([])
    service.finishWriting()
    service.finishWriting()
    expect(saves).toEqual(["Ring the plumber first"])
  })

  it("doesn't rewrite notes that were only looked at, however they were written", () => {
    const { saves, service } = makeNotesDraftService("* one\n* two")
    const shown = service.state.shown
    service.startWriting()
    service.finishWriting()
    expect(service.state.shown).toBe(shown)
    service.startWriting()
    service.write("- one\n- two")
    service.finishWriting()
    service.dispose()
    expect(saves).toEqual([])
  })

  it("saves a checklist tick at once, since ticking doesn't enter the notes", () => {
    const { saves, service } = makeNotesDraftService("- [ ] Buy washers")
    service.write("- [x] Buy washers")
    expect(saves).toEqual(["- [x] Buy washers"])
  })

  it("saves what was written when the page goes", () => {
    const { saves, service } = makeNotesDraftService()
    service.startWriting()
    service.write("Half a thought")
    service.dispose()
    expect(saves).toEqual(["Half a thought"])
  })

  it("shows someone else's change at once, unless you're writing", () => {
    const { service } = makeNotesDraftService("Old")
    const shown = service.state.shown
    service.receive("From Claude")
    expect(service.state.shown).not.toBe(shown)
    expect(service.state).toMatchObject({
      draft: "From Claude",
      source: "From Claude",
      shown: { notes: "From Claude" }
    })

    service.startWriting()
    service.write("Mine")
    service.receive("From Claude again")
    expect(service.state).toMatchObject({ draft: "Mine", shown: { notes: "From Claude" } })
  })

  it("keeps your writing over a change received meanwhile, and saves it", () => {
    const { saves, service } = makeNotesDraftService("Old")
    service.startWriting()
    service.receive("From Claude")
    service.write("Mine")
    service.finishWriting()
    expect(saves).toEqual(["Mine"])
  })

  it("ignores receiving its own save back", () => {
    const { service } = makeNotesDraftService()
    service.startWriting()
    service.write("Mine")
    service.finishWriting()
    const shown = service.state.shown
    service.receive("Mine")
    expect(service.state.shown).toBe(shown)
  })

  it("writes Markdown as typed, normalising it on leaving", () => {
    const { saves, service } = makeNotesDraftService("", new FakeModeStore(NotesMode.MARKDOWN))
    service.startWriting()
    service.writeSource("* one\n* two")
    expect(service.state.source).toBe("* one\n* two")
    service.finishWriting()
    expect(saves).toEqual(["- one\n- two"])
    expect(service.state.source).toBe("- one\n- two")
  })

  it("carries the draft across a change of mode, and remembers the mode", () => {
    const { modes, service, telemetry } = makeNotesDraftService("**Bold**")
    service.write("**Bold** move")
    service.switchMode()
    expect(service.state).toMatchObject({ mode: NotesMode.MARKDOWN, source: "**Bold** move" })
    expect(modes.mode).toBe(NotesMode.MARKDOWN)
    service.writeSource("**Bolder**")
    service.switchMode()
    expect(service.state).toMatchObject({ mode: NotesMode.RICH, shown: { notes: "**Bolder**" } })
    expect(modes.mode).toBe(NotesMode.RICH)
    expect(telemetry.tracked()).toEqual([
      [ANALYTICS_CODES.notes.modeSwitched, { mode: NotesMode.MARKDOWN }],
      [ANALYTICS_CODES.notes.modeSwitched, { mode: NotesMode.RICH }]
    ])
  })

  it("tracks following a link, without the address", () => {
    const { service, telemetry } = makeNotesDraftService("[Shop](https://example.com)")
    service.followedLink()
    expect(telemetry.tracked()).toEqual([[ANALYTICS_CODES.notes.linkFollowed, {}]])
  })

  it("opens in the remembered mode, with the notes normalised in both editors", () => {
    const { service } = makeNotesDraftService("* Notes", new FakeModeStore(NotesMode.MARKDOWN))
    expect(service.state).toMatchObject({ mode: NotesMode.MARKDOWN, source: "- Notes", shown: { notes: "- Notes" } })
  })
})

describe("NotesDraftService, with changes from elsewhere", () => {
  it("shows a change once you've left the notes", () => {
    const { service } = makeNotesDraftService("Old")
    service.startWriting()
    service.write("Mine")
    service.finishWriting()
    service.receive("From Claude")
    expect(service.state.shown).toEqual({ notes: "From Claude" })
  })

  it("shows someone else's change after you only clicked into the notes, without saving over it", () => {
    const { saves, service } = makeNotesDraftService("Old")
    service.startWriting()
    service.receive("From Claude")
    service.finishWriting()
    expect(saves).toEqual([])
    expect(service.state.shown).toEqual({ notes: "From Claude" })
  })
})
