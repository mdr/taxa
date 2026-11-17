import { EditorContent, useEditor } from "@tiptap/react"
import { Placeholder } from "@tiptap/extensions"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import styles from "./NotesEditor.module.css"
import { notesEditorTestIds } from "./NotesEditorTestIds.ts"
import { NotesToolbar } from "./NotesToolbar.tsx"
import { NotesDraftService } from "./notes-draft-service.ts"
import { documentToNotes, notesToDocument, NOTES_EXTENSIONS } from "./notes-markdown.ts"
import { localNotesModeStore, NotesMode } from "./notes-mode.ts"
import { useServiceState } from "../services/service-hooks.ts"
import { appAnalytics } from "../telemetry/app-telemetry.ts"
import { FocusTarget, useFocusRequested, useShortcutActions } from "../shortcuts/shortcut-service.ts"
import { TaskChangeType, type TaskChange } from "../tasks/changes/task-changes-service.ts"

const PLACEHOLDER = "Add notes…"

/** A textarea as tall as its text. */
const useAutoHeight = (text: string) => {
  const field = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.max(element.scrollHeight, 120)}px`
  }, [text])
  return field
}

/**
 * Notes, edited formatted or as Markdown, and saved as Markdown when you
 * leave them. Opening notes an agent wrote never rewrites them; only an edit does.
 */
export const NotesEditor = ({ notes, change }: { notes: string; change: (change: TaskChange) => void }) => {
  const [draft] = useState(
    () =>
      new NotesDraftService(
        notes,
        (saved) => change({ type: TaskChangeType.UPDATE, request: { set: { notes: saved } } }),
        localNotesModeStore,
        appAnalytics
      )
  )
  const mode = useServiceState(draft, (state) => state.mode)
  const source = useServiceState(draft, (state) => state.source)
  const shown = useServiceState(draft, (state) => state.shown)
  const sourceField = useAutoHeight(source)
  const editor = useEditor({
    extensions: [...NOTES_EXTENSIONS, Placeholder.configure({ placeholder: PLACEHOLDER })],
    content: notesToDocument(shown.notes),
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: styles.prose,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Notes",
        "data-testid": notesEditorTestIds.editor
      },
      handleKeyDown: (view, event) => {
        if (event.key !== "Escape" && !(event.key === "Enter" && (event.metaKey || event.ctrlKey))) return false
        view.dom.blur()
        return true
      }
    },
    onUpdate: ({ editor: current }) => draft.write(documentToNotes(current.getJSON())),
    onFocus: draft.startWriting,
    onBlur: draft.finishWriting
  })

  const { focusTaken } = useShortcutActions()
  const focusWanted = useFocusRequested(FocusTarget.NOTES)
  useEffect(() => {
    if (!focusWanted) return
    if (mode === NotesMode.RICH) editor.commands.focus("end")
    else sourceField.current?.focus()
    focusTaken()
  }, [focusWanted, focusTaken, mode, editor, sourceField])
  useEffect(() => draft.dispose, [draft])
  useEffect(() => draft.receive(notes), [draft, notes])
  useEffect(() => {
    if (documentToNotes(editor.getJSON()) === shown.notes) return
    editor.commands.setContent(notesToDocument(shown.notes), { emitUpdate: false })
  }, [editor, shown])

  return (
    <section className={styles.notes} aria-label="Notes">
      <div className={styles.header}>
        {mode === NotesMode.RICH && <NotesToolbar editor={editor} />}
        <button
          type="button"
          className={styles.mode}
          aria-pressed={mode === NotesMode.MARKDOWN}
          onClick={draft.switchMode}
          title="Write the notes as Markdown"
          data-testid={notesEditorTestIds.markdownMode}
        >
          Markdown
        </button>
      </div>
      <EditorContent editor={editor} hidden={mode !== NotesMode.RICH} />
      {mode === NotesMode.MARKDOWN && (
        <textarea
          ref={sourceField}
          className={styles.source}
          value={source}
          onChange={(event) => draft.writeSource(event.target.value)}
          onFocus={draft.startWriting}
          onBlur={draft.finishWriting}
          onKeyDown={(event) => {
            if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey)))
              event.currentTarget.blur()
          }}
          placeholder={PLACEHOLDER}
          aria-label="Notes, in Markdown"
          data-testid={notesEditorTestIds.markdown}
        />
      )}
    </section>
  )
}
