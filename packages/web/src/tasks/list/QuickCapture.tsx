import { Plus } from "lucide-react"
import { useState, type SubmitEvent } from "react"
import styles from "./QuickCapture.module.css"
import { quickCaptureTestIds } from "./QuickCaptureTestIds.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { useCreateTask } from "../task-queries.ts"

/** A title, and Enter: into this domain if given, else the Inbox. */
export const QuickCapture = ({ domainPrefix }: { domainPrefix: string | undefined }) => {
  const [title, setTitle] = useState("")
  const create = useCreateTask()
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (title.trim() === "") return
    create.mutate({ title: title.trim(), domain: domainPrefix }, { onSuccess: () => setTitle("") })
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <Plus size={18} className={styles.plus} aria-hidden />
      <input
        className={styles.title}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="New task"
        placeholder="Add a task"
        data-testid={quickCaptureTestIds.title}
      />
      {title.trim() !== "" && <kbd className={styles.hint}>Enter</kbd>}
      <button type="submit" className={styles.submit} disabled={create.isPending} data-testid={quickCaptureTestIds.add}>
        Add
      </button>
      {create.isError && (
        <p className={styles.error} role="alert">
          {problemMessage(create.error)}
        </p>
      )}
    </form>
  )
}
