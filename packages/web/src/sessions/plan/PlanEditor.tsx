import type { TaskId } from "@taxa/shared/ids"
import type { Task } from "@taxa/shared/tasks/task"
import type { Minutes } from "@taxa/shared/units"
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import styles from "./PlanEditor.module.css"
import { planEditorTestIds } from "./PlanEditorTestIds.ts"
import { Direction, minuteChoices } from "./plan-edits.ts"
import { suggestionReason } from "./suggestions.ts"
import { minutesText } from "../session-text.ts"
import { useToday } from "../../dates/use-today.ts"
import { StatusIcon } from "../../tasks/StatusIcon.tsx"
import type { TaskStatus } from "@taxa/shared/tasks/task"

export interface PlanRow {
  task: Task
  minutes: Minutes
  /** When it's planned for: `2:30 – 3:15`. */
  span: string
  /** Under way or finished: it stays where it is, as it is. */
  locked: boolean
  /** Shown with its status icon, for a session under way. */
  status?: TaskStatus
  detail?: string
}

export interface PlanEditorProps {
  rows: readonly PlanRow[]
  suggestions: readonly Task[]
  search: string
  onSearch: (search: string) => void
  onAdd: (task: Task) => void
  onRemove: (taskId: TaskId) => void
  onMove: (taskId: TaskId, direction: Direction) => void
  onSetMinutes: (taskId: TaskId, minutes: Minutes) => void
  /** While a change is being saved. */
  busy?: boolean
}

/** Tasks to choose from beside the plan: in order, each with its time and when that falls. */
export const PlanEditor = ({
  rows,
  suggestions,
  search,
  onSearch,
  onAdd,
  onRemove,
  onMove,
  onSetMinutes,
  busy = false
}: PlanEditorProps) => {
  const today = useToday()
  const movable = rows.filter(({ locked }) => !locked).map(({ task }) => task.id)
  return (
    <div className={styles.columns}>
      <section className={styles.column} aria-labelledby="suggestions-heading">
        <div className={styles.columnHeader}>
          <h2 id="suggestions-heading" className={styles.columnTitle}>
            Suggestions
          </h2>
          <input
            className={styles.search}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Find any task…"
            aria-label="Find a task"
            data-testid={planEditorTestIds.search}
          />
        </div>
        {suggestions.length === 0 ? (
          <p className={styles.empty} data-testid={planEditorTestIds.noSuggestions}>
            {search ? "No task matches." : "Every task you have is in the plan."}
          </p>
        ) : (
          <ul className={styles.list}>
            {suggestions.map((task) => {
              const reason = suggestionReason(task, today)
              return (
                <li key={task.id} className={styles.row} data-testid={planEditorTestIds.suggestion}>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.add}`}
                    onClick={() => onAdd(task)}
                    disabled={busy}
                    aria-label={`Add ${task.title}`}
                    data-testid={planEditorTestIds.add}
                  >
                    <Plus size={14} aria-hidden />
                  </button>
                  <span className={styles.ref}>{task.ref}</span>
                  <span className={styles.title}>
                    <span className={styles.titleText} data-testid={planEditorTestIds.suggestionTitle}>
                      {task.title}
                    </span>
                  </span>
                  {reason && <span className={styles.reason}>{reason}</span>}
                  <span className={styles.estimate}>
                    {task.estimateMinutes ? minutesText(task.estimateMinutes) : "no estimate"}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className={styles.column} aria-labelledby="plan-heading">
        <div className={styles.columnHeader}>
          <h2 id="plan-heading" className={styles.columnTitle}>
            Your plan
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className={styles.empty} data-testid={planEditorTestIds.empty}>
            Add tasks from the suggestions, in the order you'll do them.
          </p>
        ) : (
          <ol className={styles.list}>
            {rows.map(({ task, minutes, span, locked, status, detail }) => {
              const place = movable.indexOf(task.id)
              return (
                <li
                  key={task.id}
                  className={`${styles.row} ${locked ? styles.locked : ""}`}
                  data-testid={planEditorTestIds.row}
                >
                  <span className={styles.time} data-testid={planEditorTestIds.time}>
                    {span}
                  </span>
                  {status && <StatusIcon status={status} />}
                  <span className={styles.title}>
                    <span className={styles.titleText} data-testid={planEditorTestIds.title}>
                      {task.title}
                    </span>
                    {detail && <span className={styles.detail}>{detail}</span>}
                  </span>
                  {locked ? (
                    <span className={styles.estimate}>{minutesText(minutes)}</span>
                  ) : (
                    <>
                      <select
                        className={styles.minutes}
                        value={minutes}
                        onChange={(event) => onSetMinutes(task.id, Number(event.target.value))}
                        disabled={busy}
                        aria-label={`Time for ${task.title}`}
                        data-testid={planEditorTestIds.minutes}
                      >
                        {minuteChoices(minutes).map((choice) => (
                          <option key={choice} value={choice}>
                            {minutesText(choice)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => onMove(task.id, Direction.UP)}
                        disabled={busy || place <= 0}
                        aria-label={`Move ${task.title} earlier`}
                        data-testid={planEditorTestIds.moveUp}
                      >
                        <ArrowUp size={14} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => onMove(task.id, Direction.DOWN)}
                        disabled={busy || place === movable.length - 1}
                        aria-label={`Move ${task.title} later`}
                        data-testid={planEditorTestIds.moveDown}
                      >
                        <ArrowDown size={14} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => onRemove(task.id)}
                        disabled={busy}
                        aria-label={`Take ${task.title} out`}
                        data-testid={planEditorTestIds.remove}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
