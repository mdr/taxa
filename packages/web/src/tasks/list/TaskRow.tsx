import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { taskHighlights } from "@taxa/shared/tasks/task-highlights"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { Link } from "wouter"
import styles from "./TaskRow.module.css"
import { taskRowTestIds } from "./TaskRowTestIds.ts"
import { TaskChangeType, useTaskChanges } from "../use-task-changes.ts"

export const TaskRow = ({ task, today }: { task: Task; today: IsoDate }) => {
  const { change, problem } = useTaskChanges(task, task.ref)
  const done = task.status === TaskStatus.DONE
  const highlights = taskHighlights(task, today)
  return (
    <li className={styles.row} data-testid={taskRowTestIds.row}>
      <input
        type="checkbox"
        className={styles.done}
        checked={done}
        onChange={() =>
          change({ type: TaskChangeType.STATUS, request: { status: done ? TaskStatus.OPEN : TaskStatus.DONE } })
        }
        aria-label={`Done: ${task.title}`}
        data-testid={taskRowTestIds.done}
      />
      <span className={styles.ref} data-testid={taskRowTestIds.ref}>
        {task.ref}
      </span>
      <Link href={`/tasks/${task.ref}`} className={styles.title} data-testid={taskRowTestIds.title}>
        {task.title}
      </Link>
      {highlights.length > 0 && (
        <span className={styles.highlights} data-testid={taskRowTestIds.highlights}>
          {highlights.join(" · ")}
        </span>
      )}
      {problem && (
        <span className={styles.problem} role="alert">
          {problem}
        </span>
      )}
    </li>
  )
}
