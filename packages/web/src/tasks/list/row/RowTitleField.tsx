import { useEffect, useRef, useState } from "react"
import styles from "./RowTitleField.module.css"
import { rowTitleFieldTestIds } from "./RowTitleFieldTestIds.ts"
import { tidiedTitle } from "../../tidied-title.ts"

/** A row's title, being renamed in place: Enter or leaving it saves, Escape keeps the title as it was. */
export const RowTitleField = ({
  title,
  onRename,
  onDone
}: {
  title: string
  onRename: (title: string) => void
  /** Renamed or not, the field is finished with. */
  onDone: () => void
}) => {
  const [draft, setDraft] = useState(title)
  const field = useRef<HTMLInputElement>(null)
  const finished = useRef(false)
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [])
  const finish = (save: boolean): void => {
    if (finished.current) return
    finished.current = true
    const tidied = tidiedTitle(draft)
    if (save && tidied !== undefined && tidied !== title) onRename(tidied)
    onDone()
  }
  return (
    <input
      ref={field}
      className={styles.field}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          finish(true)
        } else if (event.key === "Escape") {
          event.preventDefault()
          finish(false)
        }
      }}
      aria-label={`Rename ${title}`}
      data-testid={rowTitleFieldTestIds.field}
      data-track="RowTitleField.field"
    />
  )
}
