import { EditorContent, useEditor } from "@tiptap/react"
import { Placeholder } from "@tiptap/extensions"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import styles from "./NotesEditor.module.css"
import { notesEditorTestIds } from "./NotesEditorTestIds.ts"
import { NotesToolbar } from "./NotesToolbar.tsx"
import { documentToNotes, normaliseNotes, notesToDocument, NOTES_EXTENSIONS } from "./notes-markdown.ts"
import { loadNotesMode, NotesMode, saveNotesMode } from "./notes-mode.ts"
import { TaskChangeType, type TaskChange } from "../tasks/use-task-changes.ts"

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
  const [mode, setMode] = useState(loadNotesMode)
  const [source, setSource] = useState("")
  const sourceField = useAutoHeight(source)
  // The notes as last saved or received, and as now written, both normalised.
  const saved = useRef(normaliseNotes(notes))
  const draft = useRef(saved.current)
  const changeRef = useRef(change)
  useLayoutEffect(() => {
    changeRef.current = change
  })
  const save = () => {
    if (draft.current === saved.current) return
    saved.current = draft.current
    changeRef.current({ type: TaskChangeType.UPDATE, request: { set: { notes: draft.current } } })
  }
  const editor = useEditor({
    extensions: [...NOTES_EXTENSIONS, Placeholder.configure({ placeholder: PLACEHOLDER })],
    content: notesToDocument(notes),
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
    onUpdate: ({ editor: current }) => {
      draft.current = documentToNotes(current.getJSON())
      // Ticking a checklist item doesn't focus the editor, so there's no leaving to wait for.
      if (!current.isFocused) save()
    },
    onBlur: save
  })

  // Leaving the page with an edit in hand.
  useEffect(() => () => save(), [])

  // Someone else's change, shown unless you're in the middle of writing.
  useEffect(() => {
    const incoming = normaliseNotes(notes)
    if (incoming === saved.current) return
    saved.current = incoming
    if (editor.isFocused || document.activeElement === sourceField.current) return
    draft.current = incoming
    editor.commands.setContent(notesToDocument(incoming), { emitUpdate: false })
    setSource(incoming)
  }, [notes, editor, sourceField])

  const switchMode = () => {
    const next = mode === NotesMode.RICH ? NotesMode.MARKDOWN : NotesMode.RICH
    if (next === NotesMode.MARKDOWN) setSource(draft.current)
    else editor.commands.setContent(notesToDocument(draft.current), { emitUpdate: false })
    setMode(next)
    saveNotesMode(next)
  }

  return (
    <section className={styles.notes} aria-label="Notes">
      <div className={styles.header}>
        {mode === NotesMode.RICH && <NotesToolbar editor={editor} />}
        <button
          type="button"
          className={styles.mode}
          aria-pressed={mode === NotesMode.MARKDOWN}
          onClick={switchMode}
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
          onChange={(event) => {
            setSource(event.target.value)
            draft.current = normaliseNotes(event.target.value)
          }}
          onBlur={() => {
            save()
            setSource(draft.current)
          }}
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
