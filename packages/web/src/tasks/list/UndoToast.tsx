import type { Task } from "@taxa/shared/tasks/task"
import { CircleCheck, Plus, Trash2 } from "lucide-react"
import styles from "./UndoToast.module.css"
import { undoToastTestIds } from "./UndoToastTestIds.ts"
import { Undo, useListSession } from "./list-session-service.ts"
import { useFollowOn } from "../follow-ons/follow-on-service.ts"

/** "Done: …, + Follow-on, Undo" or "Deleted: …, Undo", while the list's session offers to undo ticking it off or deleting it. */
export const UndoToast = ({ task, undoes }: { task: Task; undoes: Undo }) => {
  const { undo } = useListSession()
  const { start } = useFollowOn()
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
      {undoes === Undo.TICK && (
        <button
          type="button"
          className={styles.followOn}
          onClick={() => start(task)}
          data-testid={undoToastTestIds.followOn}
        >
          <Plus size={14} aria-hidden /> Follow-on
        </button>
      )}
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
