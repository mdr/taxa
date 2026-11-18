import { When, whenRequest } from "@taxa/shared/tasks/when"
import { Plus } from "lucide-react"
import { Link } from "wouter"
import styles from "./TodayAttention.module.css"
import { todayAttentionTestIds } from "./TodayAttentionTestIds.ts"
import { needingAttention } from "./attention.ts"
import { useToday } from "../dates/use-today.ts"
import { TaskChangeType, useTaskChanges } from "../tasks/changes/task-changes-service.ts"
import { useTasks } from "../tasks/task-queries.ts"
import { PLAN_TODAY_PATH } from "../tasks/when/when-paths.ts"

/** The most it shows; Plan today has the rest. */
const MOST_SHOWN = 3

/** Below Today: what isn't planned for it but might want to be, to bring in with a click. */
export const TodayAttention = () => {
  const today = useToday()
  const tasks = useTasks({})
  const { change } = useTaskChanges()
  const needing = needingAttention(tasks.data ?? [], today)
  if (needing.length === 0) return undefined
  return (
    <section className={styles.attention} aria-labelledby="attention-heading" data-testid={todayAttentionTestIds.box}>
      <div className={styles.header}>
        <h2 id="attention-heading" className={styles.heading}>
          Might want attention
        </h2>
        {needing.length > MOST_SHOWN && (
          <Link href={PLAN_TODAY_PATH} className={styles.all} data-testid={todayAttentionTestIds.reviewAll}>
            Review all {needing.length}
          </Link>
        )}
      </div>
      <ul className={styles.list}>
        {needing.slice(0, MOST_SHOWN).map(({ task, reason }) => (
          <li key={task.id} className={styles.item} data-testid={todayAttentionTestIds.item}>
            <Link href={`/tasks/${task.ref}`} className={styles.title} data-testid={todayAttentionTestIds.title}>
              {task.title}
            </Link>
            <span className={styles.reason} data-testid={todayAttentionTestIds.reason}>
              {reason}
            </span>
            <button
              type="button"
              className={styles.add}
              onClick={() =>
                void change(task, { type: TaskChangeType.UPDATE, request: whenRequest(When.TODAY, today) })
              }
              aria-label={`Plan ${task.title} for today`}
              data-testid={todayAttentionTestIds.add}
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
