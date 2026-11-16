import { useState } from "react"
import styles from "./TitleField.module.css"
import { titleFieldTestIds } from "./TitleFieldTestIds.ts"
import { TaskChangeType, type TaskChange } from "../use-task-changes.ts"

/** The title, saved when you leave it or press Enter. */
export const TitleField = ({ title, change }: { title: string; change: (change: TaskChange) => void }) => {
  const [draft, setDraft] = useState(title)
  const save = () => {
    const trimmed = draft.trim()
    if (trimmed === "") setDraft(title)
    else if (trimmed !== title) change({ type: TaskChangeType.UPDATE, request: { set: { title: trimmed } } })
  }
  return (
    <input
      className={styles.title}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") setDraft(title)
      }}
      aria-label="Title"
      data-testid={titleFieldTestIds.title}
    />
  )
}
