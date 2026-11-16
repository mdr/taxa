import { useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import styles from "./NotesEditor.module.css"
import { notesEditorTestIds } from "./NotesEditorTestIds.ts"
import { TaskChangeType, type TaskChange } from "../use-task-changes.ts"

/** Notes are Markdown: shown rendered, edited as text. */
export const NotesEditor = ({ notes, change }: { notes: string; change: (change: TaskChange) => void }) => {
  const [draft, setDraft] = useState<string>()
  return (
    <section className={styles.notes} aria-labelledby="notes-heading">
      <h2 id="notes-heading" className={styles.heading}>
        Notes
      </h2>
      {draft === undefined ? (
        <>
          {notes.trim() === "" ? (
            <p className={styles.empty}>No notes.</p>
          ) : (
            <div className={styles.rendered} data-testid={notesEditorTestIds.rendered}>
              <Markdown remarkPlugins={[remarkGfm]}>{notes}</Markdown>
            </div>
          )}
          <button type="button" onClick={() => setDraft(notes)} data-testid={notesEditorTestIds.edit}>
            Edit notes
          </button>
        </>
      ) : (
        <>
          <textarea
            className={styles.text}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={12}
            aria-label="Notes, in Markdown"
            data-testid={notesEditorTestIds.text}
          />
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => {
                if (draft !== notes) change({ type: TaskChangeType.UPDATE, request: { set: { notes: draft } } })
                setDraft(undefined)
              }}
              data-testid={notesEditorTestIds.save}
            >
              Save
            </button>
            <button type="button" onClick={() => setDraft(undefined)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  )
}
