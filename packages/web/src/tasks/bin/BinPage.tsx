import { realClock } from "@taxa/shared/clock"
import { ArchiveRestore, Trash2 } from "lucide-react"
import styles from "./BinPage.module.css"
import { binPageTestIds } from "./BinPageTestIds.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { browserTimeZone } from "../../dates/browser-time-zone.ts"
import { relativeTime } from "../../dates/relative-time.ts"
import { TaskChangeType, useTaskChanges } from "../changes/task-changes-service.ts"
import { useTasks } from "../task-queries.ts"

/** Deleted tasks, the last deleted first, each with a way to bring it back. */
export const BinPage = () => {
  const bin = useTasks({ deleted: "true" })
  const { change } = useTaskChanges()
  const now = realClock.now()
  const timeZone = browserTimeZone()
  return (
    <section className={styles.page} aria-labelledby="bin-heading">
      <header className={styles.header}>
        <Trash2 size={22} className={styles.icon} aria-hidden />
        <h1 id="bin-heading" className={styles.heading} data-testid={binPageTestIds.heading}>
          Bin
        </h1>
      </header>
      <p className={styles.lede}>Restoring a task puts it back where it was.</p>
      {bin.isError && <p role="alert">{problemMessage(bin.error)}</p>}
      {bin.data?.length === 0 && (
        <p className={styles.empty} data-testid={binPageTestIds.empty}>
          Nothing’s been deleted.
        </p>
      )}
      {bin.data && bin.data.length > 0 && (
        <ul className={styles.tasks} data-testid={binPageTestIds.tasks}>
          {bin.data.map((task) => (
            <li key={task.id} className={styles.task} data-testid={binPageTestIds.task}>
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
                data-testid={binPageTestIds.restore}
                data-track="BinPage.restore"
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
