import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { CalendarClock, CalendarDays } from "lucide-react"
import { useState } from "react"
import { Link } from "wouter"
import styles from "./TaskRow.module.css"
import { taskRowTestIds } from "./TaskRowTestIds.ts"
import { TickBox } from "./TickBox.tsx"
import { PriorityIcon } from "../PriorityIcon.tsx"
import { StatusIcon } from "../StatusIcon.tsx"
import { capitalised } from "../../ui/capitalised.ts"
import { TaskChangeType, useTaskChanges, useTaskProblem } from "../changes/task-changes-service.ts"

const dueClass = (due: IsoDate, today: IsoDate): string | undefined =>
  due < today ? styles.overdue : due === today ? styles.dueToday : styles.meta

interface TaskRowProps {
  task: Task
  today: IsoDate
  /** Hears when the task is ticked off or unticked. */
  onStatusChanged?: (task: Task) => void
}

export const TaskRow = ({ task, today, onStatusChanged }: TaskRowProps) => {
  const { change } = useTaskChanges()
  const problem = useTaskProblem(task.id)
  // The box shows the tick at once, before the server answers, and goes back if it refuses.
  const [ticked, setTicked] = useState<boolean>()
  const shownTick = problem === undefined ? ticked : undefined
  const done = shownTick ?? task.status === TaskStatus.DONE
  return (
    <li
      className={styles.row}
      data-done={done}
      data-celebrate={done && shownTick === true}
      data-testid={taskRowTestIds.row}
    >
      <TickBox
        checked={done}
        celebrate={shownTick === true}
        priority={task.priority}
        label={`Done: ${task.title}`}
        onChange={() => {
          setTicked(!done)
          void change(task, {
            type: TaskChangeType.STATUS,
            request: { status: done ? TaskStatus.OPEN : TaskStatus.DONE }
          }).then((changed) => changed && onStatusChanged?.(changed))
        }}
        testId={taskRowTestIds.done}
      />
      <Link href={`/tasks/${task.ref}`} className={styles.title} data-testid={taskRowTestIds.title}>
        {task.title}
      </Link>
      <span className={styles.details} data-testid={taskRowTestIds.highlights}>
        {(task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.WAITING) && (
          <span className={styles.meta}>
            <StatusIcon status={task.status} size={14} />
            {task.waitingOn ? `Waiting on ${task.waitingOn}` : capitalised(STATUS_TEXT[task.status])}
          </span>
        )}
        {task.priority !== Priority.NORMAL && (
          <span className={styles.meta}>
            <PriorityIcon priority={task.priority} size={14} />
            {capitalised(PRIORITY_TEXT[task.priority])}
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
        <span className={styles.problem} role="alert" data-testid={taskRowTestIds.problem}>
          {problem}
        </span>
      )}
    </li>
  )
}
