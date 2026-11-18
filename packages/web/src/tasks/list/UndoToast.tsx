import type { Task } from "@taxa/shared/tasks/task"
import { CircleCheck, Trash2 } from "lucide-react"
import styles from "./UndoToast.module.css"
import { undoToastTestIds } from "./UndoToastTestIds.ts"
import { Undo, useListSession } from "./list-session-service.ts"

/** "Done: …, Undo" or "Deleted: …, Undo", while the list's session offers to undo ticking it off or deleting it. */
export const UndoToast = ({ task, undoes }: { task: Task; undoes: Undo }) => {
  const { undo } = useListSession()
  return (
    <div className={styles.toast} role="status" data-testid={undoToastTestIds.toast}>
      {undoes === Undo.DELETE ? (
        <Trash2 size={16} className={styles.icon} aria-hidden />
      ) : (
        <CircleCheck size={16} className={styles.icon} aria-hidden />
      )}
      <span className={styles.text}>
        {undoes === Undo.DELETE ? "Deleted" : "Done"}: <span className={styles.title}>{task.title}</span>
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
