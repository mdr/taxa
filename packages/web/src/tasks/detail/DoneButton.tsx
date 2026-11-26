import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { CSSProperties } from "react"
import styles from "./DoneButton.module.css"
import { doneButtonTestIds } from "./DoneButtonTestIds.ts"
import { useCelebrated, useListSession, useShownDone } from "../list/list-session-service.ts"

const SPARKS = 10

/** On a task's page: marks it done, the plainest thing to do with it, as ticking its row does; again, takes that back. */
export const DoneButton = ({ task }: { task: Task }) => {
  const { toggle } = useListSession()
  const done = useShownDone(task)
  const celebrate = useCelebrated(task.id)
  if (task.deletedAt || task.status === TaskStatus.CANCELLED) return undefined
  const label = task.repeat ? "Done this time" : "Mark done"
  return (
    <button
      type="button"
      className={styles.done}
      onClick={() => void toggle(task)}
      aria-pressed={done}
      aria-keyshortcuts="X"
      title={done ? "Take it back (X)" : `${label} (X)`}
      data-done={done}
      data-celebrate={done && celebrate}
      data-testid={doneButtonTestIds.done}
      data-track="DoneButton.done"
    >
      <svg className={styles.check} viewBox="0 0 24 24" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
      </svg>
      {done ? "Done" : label}
      {!done && <kbd className={styles.key}>X</kbd>}
      {done && celebrate && (
        <span className={styles.sparks} aria-hidden>
          {Array.from({ length: SPARKS }, (_, index) => (
            <i key={index} style={{ "--angle": `${(360 / SPARKS) * index}deg` } as CSSProperties} />
          ))}
        </span>
      )}
    </button>
  )
}
