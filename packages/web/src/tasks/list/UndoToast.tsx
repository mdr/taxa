import type { Task } from "@taxa/shared/tasks/task"
import { CircleCheck } from "lucide-react"
import styles from "./UndoToast.module.css"
import { undoToastTestIds } from "./UndoToastTestIds.ts"
import { useListSession } from "./list-session-service.ts"

/** "Done: …, Undo", while the list's session offers to undo ticking it off. */
export const UndoToast = ({ task }: { task: Task }) => {
  const { undo } = useListSession()
  return (
    <div className={styles.toast} role="status" data-testid={undoToastTestIds.toast}>
      <CircleCheck size={16} className={styles.icon} aria-hidden />
      <span className={styles.text}>
        Done: <span className={styles.title}>{task.title}</span>
      </span>
      <button
        type="button"
        className={styles.undo}
        onClick={() => void undo()}
        aria-keyshortcuts="Meta+Z Control+Z"
        data-testid={undoToastTestIds.undo}
      >
        Undo
      </button>
    </div>
  )
}
