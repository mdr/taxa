import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { CircleCheck } from "lucide-react"
import { useEffect } from "react"
import styles from "./UndoToast.module.css"
import { undoToastTestIds } from "./UndoToastTestIds.ts"
import { TaskChangeType, useTaskChanges } from "../use-task-changes.ts"

const SHOWN_MS = 6000

interface UndoToastProps {
  task: Task
  onReopened: (task: Task) => void
  onDismiss: () => void
}

/** "Done: …, Undo", for a few seconds after ticking a task off. */
export const UndoToast = ({ task, onReopened, onDismiss }: UndoToastProps) => {
  const { change } = useTaskChanges(task, task.ref, onReopened)
  useEffect(() => {
    const timer = setTimeout(onDismiss, SHOWN_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])
  return (
    <div className={styles.toast} role="status" data-testid={undoToastTestIds.toast}>
      <CircleCheck size={16} className={styles.icon} aria-hidden />
      <span className={styles.text}>
        Done: <span className={styles.title}>{task.title}</span>
      </span>
      <button
        type="button"
        className={styles.undo}
        onClick={() => {
          change({ type: TaskChangeType.STATUS, request: { status: TaskStatus.OPEN } })
          onDismiss()
        }}
        data-testid={undoToastTestIds.undo}
      >
        Undo
      </button>
    </div>
  )
}
