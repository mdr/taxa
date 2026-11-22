import { realClock } from "@taxa/shared/clock"
import { ArchiveRestore, Trash2 } from "lucide-react"
import styles from "./TrashPage.module.css"
import { trashPageTestIds } from "./TrashPageTestIds.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { browserTimeZone } from "../../dates/browser-time-zone.ts"
import { relativeTime } from "../../dates/relative-time.ts"
import { TaskChangeType, useTaskChanges } from "../changes/task-changes-service.ts"
import { useTasks } from "../task-queries.ts"

/** Deleted tasks, the last deleted first, each with a way to bring it back. */
export const TrashPage = () => {
  const trash = useTasks({ deleted: "true" })
  const { change } = useTaskChanges()
  const now = realClock.now()
  const timeZone = browserTimeZone()
  return (
    <section className={styles.page} aria-labelledby="trash-heading">
      <header className={styles.header}>
        <Trash2 size={22} className={styles.icon} aria-hidden />
        <h1 id="trash-heading" className={styles.heading} data-testid={trashPageTestIds.heading}>
          Trash
        </h1>
      </header>
      <p className={styles.lede}>Restoring a task puts it back where it was.</p>
      {trash.isError && <p role="alert">{problemMessage(trash.error)}</p>}
      {trash.data?.length === 0 && (
        <p className={styles.empty} data-testid={trashPageTestIds.empty}>
          Nothing’s been deleted.
        </p>
      )}
      {trash.data && trash.data.length > 0 && (
        <ul className={styles.tasks} data-testid={trashPageTestIds.tasks}>
          {trash.data.map((task) => (
            <li key={task.id} className={styles.task} data-testid={trashPageTestIds.task}>
              <span className={styles.ref}>{task.ref}</span>
              <span className={styles.title}>{task.title}</span>
              {task.deletedAt && (
                <time className={styles.when} dateTime={task.deletedAt}>
                  deleted {relativeTime(Date.parse(task.deletedAt), now, timeZone)}
                </time>
              )}
              <button
                type="button"
                className={styles.restore}
                onClick={() => void change(task, { type: TaskChangeType.RESTORE })}
                aria-label={`Restore ${task.ref} ${task.title}`}
                data-testid={trashPageTestIds.restore}
                data-track="TrashPage.restore"
              >
                <ArchiveRestore size={14} aria-hidden /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
