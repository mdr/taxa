import { formatDay } from "@taxa/shared/dates/date-format"
import { RowMenuEntry } from "./row-menu-entry.ts"
import { TagChip } from "../../../tags/TagChip.tsx"
import { sameTag } from "@taxa/shared/tasks/tags"
import type { Domain } from "@taxa/shared/domains/domain"
import type { UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { CalendarClock } from "lucide-react"
import { useEffect, useRef } from "react"
import { Link } from "wouter"
import styles from "./TaskRow.module.css"
import { taskRowTestIds } from "./TaskRowTestIds.ts"
import { TickBox } from "./TickBox.tsx"
import { PriorityIcon } from "../../PriorityIcon.tsx"
import { StatusIcon } from "../../StatusIcon.tsx"
import { capitalised } from "../../../ui/capitalised.ts"
import {
  useCelebrated,
  useHighlighted,
  useListSession,
  useRenaming,
  useRowMenuOpening,
  useShownDone
} from "../list-session-service.ts"
import { TaskChangeType, useTaskChanges, useTaskProblem } from "../../changes/task-changes-service.ts"
import { RowTitleField } from "./RowTitleField.tsx"
import { DomainChoice } from "../../filing/DomainChoice.tsx"
import { TaskRowMenu } from "./TaskRowMenu.tsx"
import type { When } from "@taxa/shared/tasks/when"
import { WhenTag } from "../../when/WhenTag.tsx"

/** In the Inbox: the domains to file a task in, and how. */
export interface Filing {
  domains: readonly Domain[]
  file: (task: Task, request: UpdateTaskRequest) => void
}

const dueClass = (due: IsoDate, today: IsoDate): string | undefined =>
  due < today ? styles.overdue : due === today ? styles.dueToday : styles.meta

export const TaskRow = ({
  task,
  today,
  domains,
  filing,
  listedBy,
  listedTag,
  onDelete
}: {
  task: Task
  today: IsoDate
  /** Where it can be moved to, from its menu. */
  domains: readonly Domain[]
  filing?: Filing
  /** The When the list is made of, which its rows needn't say. */
  listedBy?: When
  /** The tag the list is made of, which its rows needn't show. */
  listedTag?: string
  /** Deletes it from its menu, with a chance to undo it. */
  onDelete: (task: Task) => void
}) => {
  const { toggle, highlight, rememberOpened, rename } = useListSession()
  const { change } = useTaskChanges()
  const highlighted = useHighlighted(task.id)
  const renaming = useRenaming(task.id)
  const row = useRef<HTMLLIElement>(null)
  const wasRenaming = useRef(false)
  // Renamed, the keyboard goes back to the row.
  useEffect(() => {
    if (wasRenaming.current && !renaming && highlighted) row.current?.querySelector("a")?.focus()
    wasRenaming.current = renaming
  }, [renaming, highlighted])
  // The highlight is the keyboard's focus, so Enter opens the task and screen readers follow it.
  useEffect(() => {
    if (highlighted && !row.current?.contains(document.activeElement)) row.current?.querySelector("a")?.focus()
  }, [highlighted])
  // Clicking or tabbing into the row highlights it too; leaving it lets go.
  useEffect(() => {
    const element = row.current
    if (!element) return undefined
    const entered = (): void => highlight(task.id)
    const left = (event: FocusEvent): void => {
      if (!(event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) highlight(undefined)
    }
    element.addEventListener("focusin", entered)
    element.addEventListener("focusout", left)
    return () => {
      element.removeEventListener("focusin", entered)
      element.removeEventListener("focusout", left)
    }
  }, [highlight, task.id])
  const problem = useTaskProblem(task.id)
  const opening = useRowMenuOpening(task)
  const done = useShownDone(task)
  const celebrate = useCelebrated(task.id)
  return (
    <li
      ref={row}
      className={styles.row}
      data-done={done}
      data-celebrate={done && celebrate}
      data-highlighted={highlighted}
      data-testid={taskRowTestIds.row}
    >
      <TickBox
        checked={done}
        celebrate={celebrate}
        priority={task.priority}
        label={`Done: ${task.title}`}
        onChange={() => void toggle(task)}
        testId={taskRowTestIds.done}
      />
      {renaming ? (
        <RowTitleField
          title={task.title}
          onRename={(title) => void change(task, { type: TaskChangeType.UPDATE, request: { set: { title } } })}
          onDone={() => rename(undefined)}
        />
      ) : (
        <Link
          href={`/tasks/${task.ref}`}
          className={styles.title}
          onClick={() => rememberOpened(task)}
          data-testid={taskRowTestIds.title}
        >
          {task.title}
        </Link>
      )}
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
        <WhenTag task={task} today={today} listedBy={listedBy} className={styles.meta} />
        {task.due && (
          <span className={dueClass(task.due, today)}>
            <CalendarClock size={14} aria-hidden />
            Due {formatDay(task.due, today)}
          </span>
        )}
        {task.tags
          .filter((name) => listedTag === undefined || !sameTag(name, listedTag))
          .map((name) => (
            <TagChip key={name} name={name} />
          ))}
      </span>
      {filing && task.inbox && (
        <DomainChoice
          task={task}
          domains={filing.domains}
          testId={taskRowTestIds.domain}
          opening={opening?.entry === RowMenuEntry.FILE ? opening.seq : undefined}
          onChoose={(request) => filing.file(task, request)}
        />
      )}
      <span className={styles.ref} data-testid={taskRowTestIds.ref}>
        {task.ref}
      </span>
      <span className={styles.menu}>
        <TaskRowMenu task={task} today={today} domains={domains} onDelete={() => onDelete(task)} />
      </span>
      {problem && (
        <span className={styles.problem} role="alert" data-testid={taskRowTestIds.problem}>
          {problem}
        </span>
      )}
    </li>
  )
}
