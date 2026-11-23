import type { Task } from "@taxa/shared/tasks/task"
import { Plus } from "lucide-react"
import { useState, type SubmitEvent } from "react"
import styles from "./PlanCapture.module.css"
import { planCaptureTestIds } from "./PlanCaptureTestIds.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { useCreateTask } from "../../tasks/task-queries.ts"

/** Under the plan: a task thought of while planning, added to the Inbox and to the end of the plan. */
export const PlanCapture = ({ busy, onCreated }: { busy: boolean; onCreated: (task: Task) => void }) => {
  const [title, setTitle] = useState("")
  const create = useCreateTask()
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (title.trim() === "" || create.isPending) return
    create.mutate(
      { title: title.trim() },
      {
        onSuccess: (task) => {
          setTitle("")
          onCreated(task)
          appAnalytics.track(ANALYTICS_CODES.task.captured, `captured ${task.ref} into a plan`, {
            taskId: task.id,
            taskRef: task.ref,
            domainId: task.domainId
          })
        }
      }
    )
  }
  return (
    <form className={styles.form} onSubmit={submit} data-testid={planCaptureTestIds.form}>
      <Plus size={16} className={styles.plus} aria-hidden />
      <input
        className={styles.title}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur()
        }}
        placeholder="New task"
        aria-label="New task, added to the plan"
        data-testid={planCaptureTestIds.title}
        data-track="PlanCapture.title"
      />
      <button
        type="submit"
        className={styles.submit}
        disabled={busy || create.isPending}
        data-testid={planCaptureTestIds.add}
        data-track="PlanCapture.add"
      >
        Add
      </button>
      {create.isError && (
        <p className={styles.error} role="alert" data-testid={planCaptureTestIds.error}>
          {problemMessage(create.error)}
        </p>
      )}
    </form>
  )
}
