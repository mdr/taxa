import { useEffect, useLayoutEffect, useRef, useState } from "react"
import styles from "./TitleField.module.css"
import { tidiedTitle } from "../tidied-title.ts"
import { titleFieldTestIds } from "./TitleFieldTestIds.ts"
import { TaskChangeType, type TaskChange } from "../changes/task-changes-service.ts"
import { FocusTarget, useFocusRequested, useShortcutActions } from "../../shortcuts/shortcut-service.ts"

/** The title as the page's heading, edited in place: saved on Enter or leaving it, Escape undoes. */
export const TitleField = ({ title, change }: { title: string; change: (change: TaskChange) => void }) => {
  const [draft, setDraft] = useState(title)
  const field = useRef<HTMLTextAreaElement>(null)
  const { focusTaken } = useShortcutActions()
  const focusWanted = useFocusRequested(FocusTarget.TITLE)
  useEffect(() => {
    if (!focusWanted) return
    field.current?.focus()
    field.current?.select()
    focusTaken()
  }, [focusWanted, focusTaken])
  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }, [draft])
  const save = () => {
    const tidied = tidiedTitle(draft)
    if (tidied === undefined) setDraft(title)
    else if (tidied !== title) change({ type: TaskChangeType.UPDATE, request: { set: { title: tidied } } })
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
      aria-keyshortcuts="R"
      data-testid={titleFieldTestIds.title}
    />
  )
}
