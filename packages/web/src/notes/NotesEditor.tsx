import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { Placeholder } from "@tiptap/extensions"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import styles from "./NotesEditor.module.css"
import { notesEditorTestIds } from "./NotesEditorTestIds.ts"
import { NotesToolbar } from "./NotesToolbar.tsx"
import { LinkBar } from "./LinkBar.tsx"
import { LinkForm } from "./LinkForm.tsx"
import { isWebAddress } from "./link-address.ts"
import { applyLink, linkDraftAt, removeLink, type LinkDraft } from "./notes-links.ts"
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
  const writing = useServiceState(draft, (state) => state.writing)
  const sourceField = useAutoHeight(source)
  const [linking, setLinking] = useState<LinkDraft | undefined>()
  // The editor's key handler is set once, so it reaches the editor through this.
  const openLinkForm = useRef<() => void>(() => undefined)
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
        if (event.key === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
          event.preventDefault()
          openLinkForm.current()
          return true
        }
        if (event.key !== "Escape" && !(event.key === "Enter" && (event.metaKey || event.ctrlKey))) return false
        view.dom.blur()
        return true
      },
      // A link isn't followed by a click, which places the cursor to edit it, but by ⌘-click.
      handleClick: (view, position, event) => {
        if (!(event.metaKey || event.ctrlKey)) return false
        const link = view.state.doc
          .resolve(position)
          .marks()
          .find((mark) => mark.type.name === "link")
        if (!link) return false
        const href = String(link.attrs["href"])
        if (isWebAddress(href)) window.open(href, "_blank", "noopener,noreferrer")
        else window.location.assign(href)
        draft.followedLink()
        return true
      }
    },
    onUpdate: ({ editor: current }) => draft.write(documentToNotes(current.getJSON())),
    onFocus: draft.startWriting,
    onBlur: draft.finishWriting
  })

  openLinkForm.current = () => setLinking(linkDraftAt(editor))
  const linkHere = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current.isFocused && current.isActive("link") ? String(current.getAttributes("link")["href"] ?? "") : undefined
  })
  const closeLinkForm = (): void => {
    setLinking(undefined)
    editor.commands.focus()
  }

  const { focusTaken } = useShortcutActions()
  const focusWanted = useFocusRequested(FocusTarget.NOTES)
  useEffect(() => {
    if (!focusWanted) return
    if (mode === NotesMode.RICH) editor.commands.focus("end")
    else sourceField.current?.focus()
    focusTaken()
  }, [focusWanted, focusTaken, mode, editor, sourceField])
  useEffect(() => draft.dispose, [draft])
  // Spelling's marked while writing, not over notes that are only being read.
  useEffect(() => {
    editor.view.dom.spellcheck = writing
  }, [editor, writing])
  useEffect(() => draft.receive(notes), [draft, notes])
  useEffect(() => {
    if (documentToNotes(editor.getJSON()) === shown.notes) return
    editor.commands.setContent(notesToDocument(shown.notes), { emitUpdate: false })
  }, [editor, shown])

  return (
    <section className={styles.notes} aria-label="Notes">
      <div className={styles.header}>
        {mode === NotesMode.RICH && <NotesToolbar editor={editor} onLink={() => openLinkForm.current()} />}
        <button
          type="button"
          className={styles.mode}
          aria-pressed={mode === NotesMode.MARKDOWN}
          onClick={draft.switchMode}
          title="Write the notes as Markdown"
          data-testid={notesEditorTestIds.markdownMode}
          data-track="NotesEditor.markdownMode"
        >
          Markdown
        </button>
      </div>
      {mode === NotesMode.RICH && linking && (
        <LinkForm
          draft={linking}
          onSave={(text, address) => {
            setLinking(undefined)
            applyLink(editor, text, address)
          }}
          onRemove={() => {
            setLinking(undefined)
            removeLink(editor)
          }}
          onCancel={closeLinkForm}
        />
      )}
      <EditorContent editor={editor} hidden={mode !== NotesMode.RICH} />
      {mode === NotesMode.RICH && !linking && linkHere !== undefined && (
        <LinkBar href={linkHere} onEdit={() => openLinkForm.current()} onRemove={() => removeLink(editor)} />
      )}
      {mode === NotesMode.MARKDOWN && (
        <textarea
          ref={sourceField}
          className={styles.source}
          value={source}
          onChange={(event) => draft.writeSource(event.target.value)}
          onFocus={draft.startWriting}
          onBlur={draft.finishWriting}
          spellCheck={writing}
          onKeyDown={(event) => {
            if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey)))
              event.currentTarget.blur()
          }}
          placeholder={PLACEHOLDER}
          aria-label="Notes, in Markdown"
          data-testid={notesEditorTestIds.markdown}
          data-track="NotesEditor.markdown"
        />
      )}
    </section>
  )
}
