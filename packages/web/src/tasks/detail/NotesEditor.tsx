import { Pencil } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import styles from "./NotesEditor.module.css"
import { notesEditorTestIds } from "./NotesEditorTestIds.ts"
import { TaskChangeType, type TaskChange } from "../use-task-changes.ts"

const NotesText = ({
  draft,
  setDraft,
  save,
  cancel
}: {
  draft: string
  setDraft: (text: string) => void
  save: () => void
  cancel: () => void
}) => {
  const field = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.max(element.scrollHeight, 160)}px`
  }, [draft])
  return (
    <>
      <textarea
        ref={field}
        className={styles.text}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save()
          if (event.key === "Escape") cancel()
        }}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- it appears because you asked to write.
        autoFocus
        placeholder="Write in Markdown: **bold**, - lists, ## headings, [links](https://…)"
        aria-label="Notes, in Markdown"
        data-testid={notesEditorTestIds.text}
      />
      <div className={styles.actions}>
        <button type="button" className={styles.save} onClick={save} data-testid={notesEditorTestIds.save}>
          Done
        </button>
        <button type="button" onClick={cancel}>
          Cancel
        </button>
        <span className={styles.hint}>⌘ Enter to save · Esc to cancel</span>
      </div>
    </>
  )
}

/** Notes are Markdown: shown rendered, written as text. */
export const NotesEditor = ({ notes, change }: { notes: string; change: (change: TaskChange) => void }) => {
  const [draft, setDraft] = useState<string>()
  const save = () => {
    if (draft !== undefined && draft !== notes)
      change({ type: TaskChangeType.UPDATE, request: { set: { notes: draft } } })
    setDraft(undefined)
  }
  return (
    <section className={styles.notes} aria-label="Notes">
      {draft !== undefined ? (
        <NotesText draft={draft} setDraft={setDraft} save={save} cancel={() => setDraft(undefined)} />
      ) : notes.trim() === "" ? (
        <button type="button" className={styles.add} onClick={() => setDraft("")} data-testid={notesEditorTestIds.edit}>
          Add notes…
        </button>
      ) : (
        <div className={styles.shown}>
          <div className={styles.rendered} data-testid={notesEditorTestIds.rendered}>
            <Markdown remarkPlugins={[remarkGfm]}>{notes}</Markdown>
          </div>
          <button
            type="button"
            className={styles.edit}
            onClick={() => setDraft(notes)}
            aria-label="Edit notes"
            data-testid={notesEditorTestIds.edit}
          >
            <Pencil size={14} aria-hidden />
          </button>
        </div>
      )}
    </section>
  )
}
