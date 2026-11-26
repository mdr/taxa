import type { Task } from "@taxa/shared/tasks/task"
import { When, whenRequest } from "@taxa/shared/tasks/when"
import { Plus } from "lucide-react"
import { Link } from "wouter"
import styles from "./AttentionBox.module.css"
import { useToday } from "../dates/use-today.ts"
import { TaskChangeType, useTaskChanges } from "../tasks/changes/task-changes-service.ts"

export interface AttentionBoxTestIds {
  box: string
  item: string
  title: string
  reason: string
  add: string
  more: string
}

/** Below Today: tasks it offers, each with why and a + Today, the first few, and a link to the rest. */
export const AttentionBox = ({
  heading,
  items,
  most,
  more,
  testIds,
  track
}: {
  heading: string
  items: readonly { task: Task; reason: string }[]
  /** The most it shows. */
  most: number
  /** Where the rest are, and what the link says, when there are more than it shows; always, if `always`. */
  more: { href: string; text: string; always?: boolean }
  testIds: AttentionBoxTestIds
  /** What its + Today is tracked as. */
  track: string
}) => {
  const today = useToday()
  const { change } = useTaskChanges()
  if (items.length === 0) return undefined
  const id = `${track}-heading`
  return (
    <section className={styles.attention} aria-labelledby={id} data-testid={testIds.box}>
      <div className={styles.header}>
        <h2 id={id} className={styles.heading}>
          {heading}
        </h2>
        {(more.always === true || items.length > most) && (
          <Link href={more.href} className={styles.all} data-testid={testIds.more}>
            {more.text}
          </Link>
        )}
      </div>
      <ul className={styles.list}>
        {items.slice(0, most).map(({ task, reason }) => (
          <li key={task.id} className={styles.item} data-testid={testIds.item}>
            <Link href={`/tasks/${task.ref}`} className={styles.title} data-testid={testIds.title}>
              {task.title}
            </Link>
            <span className={styles.reason} data-testid={testIds.reason}>
              {reason}
            </span>
            <button
              type="button"
              className={styles.add}
              onClick={() =>
                void change(task, { type: TaskChangeType.UPDATE, request: whenRequest(When.TODAY, today) })
              }
              aria-label={`Plan ${task.title} for today`}
              data-testid={testIds.add}
              data-track={track}
            >
              <Plus size={13} aria-hidden />
              Today
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
