import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { CalendarClock, CalendarDays } from "lucide-react"
import { Link } from "wouter"
import styles from "./TaskRow.module.css"
import { taskRowTestIds } from "./TaskRowTestIds.ts"
import { TickBox } from "./TickBox.tsx"
import { PriorityIcon } from "../PriorityIcon.tsx"
import { StatusIcon } from "../StatusIcon.tsx"
import { capitalised } from "../../ui/capitalised.ts"
import { useCelebrated, useListSession, useShownDone } from "./list-session-service.ts"
import { useTaskProblem } from "../changes/task-changes-service.ts"

const dueClass = (due: IsoDate, today: IsoDate): string | undefined =>
  due < today ? styles.overdue : due === today ? styles.dueToday : styles.meta

export const TaskRow = ({ task, today }: { task: Task; today: IsoDate }) => {
  const { toggle } = useListSession()
  const problem = useTaskProblem(task.id)
  const done = useShownDone(task)
  const celebrate = useCelebrated(task.id)
  return (
    <li className={styles.row} data-done={done} data-celebrate={done && celebrate} data-testid={taskRowTestIds.row}>
      <TickBox
        checked={done}
        celebrate={celebrate}
        priority={task.priority}
        label={`Done: ${task.title}`}
        onChange={() => void toggle(task)}
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
