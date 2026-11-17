import { useLayoutEffect, useRef, useState } from "react"
import styles from "./TitleField.module.css"
import { titleFieldTestIds } from "./TitleFieldTestIds.ts"
import { TaskChangeType, type TaskChange } from "../use-task-changes.ts"

/** The title as the page's heading, edited in place: saved on Enter or leaving it, Escape undoes. */
export const TitleField = ({ title, change }: { title: string; change: (change: TaskChange) => void }) => {
  const [draft, setDraft] = useState(title)
  const field = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }, [draft])
  const save = () => {
    const trimmed = draft.replaceAll(/\s+/g, " ").trim()
    if (trimmed === "") setDraft(title)
    else if (trimmed !== title) change({ type: TaskChangeType.UPDATE, request: { set: { title: trimmed } } })
  }
  return (
    <textarea
      ref={field}
      className={styles.title}
      value={draft}
      rows={1}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === "Escape") setDraft(title)
      }}
      aria-label="Title"
      data-testid={titleFieldTestIds.title}
    />
  )
}
