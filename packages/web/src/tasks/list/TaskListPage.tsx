import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { ListTasksQuery } from "@taxa/shared/tasks/task-requests"
import { ChevronDown, ChevronRight, Inbox } from "lucide-react"
import { useCallback, useState } from "react"
import styles from "./TaskListPage.module.css"
import { taskListPageTestIds } from "./TaskListPageTestIds.ts"
import { QuickCapture } from "./QuickCapture.tsx"
import { TaskRow } from "./TaskRow.tsx"
import { UndoToast } from "./UndoToast.tsx"
import { withTicked } from "./with-ticked.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { useToday } from "../../dates/use-today.ts"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import { useDomains } from "../../domains/domain-queries.ts"
import { useTasks } from "../task-queries.ts"

/** A domain's tasks, or without a domain, the Inbox. */
export const TaskListPage = ({ domainPrefix }: { domainPrefix?: string }) => {
  const domains = useDomains()
  const query: ListTasksQuery = domainPrefix ? { domain: domainPrefix } : { inbox: "true" }
  const tasks = useTasks(query)
  const completed = useTasks({ ...query, status: TaskStatus.DONE })
  const today = useToday()
  // Ticked off while the list is open: they stay in place, ticked, until you leave.
  const [ticked, setTicked] = useState<ReadonlyMap<string, Task>>(new Map())
  const [toast, setToast] = useState<Task>()
  const [showCompleted, setShowCompleted] = useState(false)
  const dismissToast = useCallback(() => setToast(undefined), [])
  const statusChanged = (task: Task) => {
    setTicked((current) => {
      const next = new Map(current)
      if (task.status === TaskStatus.DONE) next.set(task.id, task)
      else next.delete(task.id)
      return next
    })
    setToast(task.status === TaskStatus.DONE ? task : undefined)
  }
  const domain = domains.data?.find(({ prefix }) => prefix === domainPrefix?.toUpperCase())
  const shown = tasks.data ? withTicked(tasks.data, ticked) : undefined
  const earlier = (completed.data ?? []).filter(({ id }) => !ticked.has(id))
  const openCount = tasks.data?.length ?? 0
  return (
    <section className={styles.page} aria-labelledby="list-heading">
      <header className={styles.header}>
        {domainPrefix ? (
          domain && <DomainBadge prefix={domain.prefix} />
        ) : (
          <Inbox size={22} className={styles.icon} aria-hidden />
        )}
        <h1 id="list-heading" className={styles.heading} data-testid={taskListPageTestIds.heading}>
          {domainPrefix ? (domain?.name ?? domainPrefix) : "Inbox"}
        </h1>
        {openCount > 0 && <span className={styles.count}>{openCount}</span>}
      </header>
      <QuickCapture domainPrefix={domain?.prefix} />
      {tasks.isError ? (
        <p className={styles.problem} role="alert" data-testid={taskListPageTestIds.error}>
          {problemMessage(tasks.error)}
        </p>
      ) : shown?.length === 0 ? (
        <div className={styles.empty} data-testid={taskListPageTestIds.empty}>
          {domainPrefix ? (
            <p>Nothing to do here. Enjoy it.</p>
          ) : (
            <>
              <p className={styles.emptyTitle}>Your Inbox is clear</p>
              <p>Capture anything above as it occurs to you, and file it into a domain later.</p>
            </>
          )}
        </div>
      ) : (
        <ul className={styles.tasks} data-testid={taskListPageTestIds.tasks}>
          {shown?.map((task) => (
            <TaskRow key={task.id} task={task} today={today} onStatusChanged={statusChanged} />
          ))}
        </ul>
      )}
      {earlier.length > 0 && (
        <div className={styles.completed}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={showCompleted}
            onClick={() => setShowCompleted(!showCompleted)}
            data-testid={taskListPageTestIds.showCompleted}
          >
            {showCompleted ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
            {earlier.length} completed
          </button>
          {showCompleted && (
            <ul className={styles.tasks} data-testid={taskListPageTestIds.completed}>
              {earlier.map((task) => (
                <TaskRow key={task.id} task={task} today={today} onStatusChanged={statusChanged} />
              ))}
            </ul>
          )}
        </div>
      )}
      {toast && <UndoToast key={toast.id} task={toast} onReopened={statusChanged} onDismiss={dismissToast} />}
    </section>
  )
}
