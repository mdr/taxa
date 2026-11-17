import { Plus } from "lucide-react"
import { useEffect, useRef, useState, type SubmitEvent } from "react"
import styles from "./QuickCapture.module.css"
import { quickCaptureTestIds } from "./QuickCaptureTestIds.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { useCreateTask } from "../task-queries.ts"
import { FocusTarget, useFocusRequested, useShortcutActions } from "../../shortcuts/shortcut-service.ts"

/** A title, and Enter: into this domain if given, else the Inbox. */
export const QuickCapture = ({ domainPrefix }: { domainPrefix: string | undefined }) => {
  const [title, setTitle] = useState("")
  const create = useCreateTask()
  const field = useRef<HTMLInputElement>(null)
  const { focusTaken } = useShortcutActions()
  const focusWanted = useFocusRequested(FocusTarget.CAPTURE)
  useEffect(() => {
    if (!focusWanted) return
    field.current?.focus()
    focusTaken()
  }, [focusWanted, focusTaken])
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (title.trim() === "") return
    create.mutate(
      { title: title.trim(), domain: domainPrefix },
      {
        onSuccess: (task) => {
          setTitle("")
          appAnalytics.track(ANALYTICS_CODES.task.captured, `captured ${task.ref}`, {
            taskId: task.id,
            taskRef: task.ref,
            domainId: task.domainId
          })
        }
      }
    )
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <Plus size={18} className={styles.plus} aria-hidden />
      <input
        ref={field}
        className={styles.title}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur()
        }}
        aria-label="New task"
        aria-keyshortcuts="C"
        placeholder="Add a task"
        data-testid={quickCaptureTestIds.title}
      />
      {title.trim() !== "" && <kbd className={styles.hint}>Enter</kbd>}
      <button type="submit" className={styles.submit} disabled={create.isPending} data-testid={quickCaptureTestIds.add}>
        Add
      </button>
      {create.isError && (
        <p className={styles.error} role="alert" data-testid={quickCaptureTestIds.error}>
          {problemMessage(create.error)}
        </p>
      )}
    </form>
  )
}
