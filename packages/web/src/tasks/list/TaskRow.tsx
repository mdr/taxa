import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { CalendarClock, CalendarDays, Check } from "lucide-react"
import { useState } from "react"
import { Link } from "wouter"
import styles from "./TaskRow.module.css"
import { taskRowTestIds } from "./TaskRowTestIds.ts"
import { PriorityIcon } from "../PriorityIcon.tsx"
import { StatusIcon } from "../StatusIcon.tsx"
import { TaskChangeType, useTaskChanges } from "../use-task-changes.ts"

const dueClass = (due: IsoDate, today: IsoDate): string | undefined =>
  due < today ? styles.overdue : due === today ? styles.dueToday : styles.meta

interface TaskRowProps {
  task: Task
  today: IsoDate
  /** Hears when the task is ticked off or unticked. */
  onStatusChanged?: (task: Task) => void
}

export const TaskRow = ({ task, today, onStatusChanged }: TaskRowProps) => {
  const { change, problem } = useTaskChanges(task, task.ref, onStatusChanged)
  // The box shows the tick at once, before the server answers.
  const [ticked, setTicked] = useState<boolean>()
  const done = ticked ?? task.status === TaskStatus.DONE
  return (
    <li className={styles.row} data-done={done} data-testid={taskRowTestIds.row}>
      <label className={styles.tick}>
        <input
          type="checkbox"
          className={styles.box}
          checked={done}
          onChange={() => {
            setTicked(!done)
            change({ type: TaskChangeType.STATUS, request: { status: done ? TaskStatus.OPEN : TaskStatus.DONE } })
          }}
          aria-label={`Done: ${task.title}`}
          data-testid={taskRowTestIds.done}
        />
        <Check size={12} strokeWidth={3} className={styles.mark} aria-hidden />
      </label>
      <Link href={`/tasks/${task.ref}`} className={styles.title} data-testid={taskRowTestIds.title}>
        {task.title}
      </Link>
      <span className={styles.details} data-testid={taskRowTestIds.highlights}>
        {(task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.WAITING) && (
          <span className={styles.meta}>
            <StatusIcon status={task.status} size={14} />
            {task.waitingOn ? `Waiting on ${task.waitingOn}` : STATUS_TEXT[task.status]}
          </span>
        )}
        {task.priority !== Priority.NORMAL && (
          <span className={styles.meta}>
            <PriorityIcon priority={task.priority} size={14} />
            {PRIORITY_TEXT[task.priority]}
          </span>
        )}
        {task.scheduled && (
          <span className={styles.meta}>
            <CalendarDays size={14} aria-hidden />
            {formatDay(task.scheduled, today)}
            {task.scheduledTime && ` ${task.scheduledTime}`}
          </span>
        )}
        {task.due && (
          <span className={dueClass(task.due, today)}>
            <CalendarClock size={14} aria-hidden />
            Due {formatDay(task.due, today)}
          </span>
        )}
      </span>
      <span className={styles.ref} data-testid={taskRowTestIds.ref}>
        {task.ref}
      </span>
      {problem && (
        <span className={styles.problem} role="alert">
          {problem}
        </span>
      )}
    </li>
  )
}
