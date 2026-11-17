import { TaskStatus } from "@taxa/shared/tasks/task"
import type { ListTasksQuery } from "@taxa/shared/tasks/task-requests"
import { ChevronDown, ChevronRight, Inbox } from "lucide-react"
import { useEffect, useState } from "react"
import styles from "./TaskListPage.module.css"
import { taskListPageTestIds } from "./TaskListPageTestIds.ts"
import { QuickCapture } from "./QuickCapture.tsx"
import { TaskRow, type Filing } from "./TaskRow.tsx"
import { UndoToast } from "./UndoToast.tsx"
import { withTicked } from "./with-ticked.ts"
import { ListSessionContext, ListSessionService } from "./list-session-service.ts"
import { listShortcuts } from "./list-shortcuts.ts"
import { useLocation } from "wouter"
import { realScheduler } from "../../services/scheduler.ts"
import { useServiceState } from "../../services/service-hooks.ts"
import { useTaskChanges } from "../changes/task-changes-service.ts"
import { ShortcutScope, useShortcuts } from "../../shortcuts/shortcut-service.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { useToday } from "../../dates/use-today.ts"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import { useDomains } from "../../domains/domain-queries.ts"
import { useTasks } from "../task-queries.ts"

/** A domain's tasks, or without a domain, the Inbox. */
export const TaskListPage = ({ domainPrefix }: { domainPrefix?: string }) => {
  // A session for each visit: the routes give each list its own page.
  const changes = useTaskChanges()
  const [session] = useState(() => new ListSessionService(changes, realScheduler))
  useEffect(() => session.dispose, [session])
  const ticked = useServiceState(session, (state) => state.ticked)
  const undoable = useServiceState(session, (state) => state.undoable)
  const domains = useDomains()
  const query: ListTasksQuery = domainPrefix ? { domain: domainPrefix } : { inbox: "true" }
  const tasks = useTasks(query)
  const completed = useTasks({ ...query, status: TaskStatus.DONE })
  const today = useToday()
  const [showCompleted, setShowCompleted] = useState(false)
  const domain = domains.data?.find(({ prefix }) => prefix === domainPrefix?.toUpperCase())
  const shown = tasks.data ? withTicked(tasks.data, ticked) : undefined
  const earlier = (completed.data ?? []).filter(({ id }) => ticked[id] === undefined)
  const [, navigate] = useLocation()
  useShortcuts(
    ShortcutScope.PAGE,
    listShortcuts(
      [...(shown ?? []), ...(showCompleted ? earlier : [])],
      session,
      (task) => navigate(`/tasks/${task.ref}`),
      () => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      }
    )
  )
  const openCount = tasks.data?.length ?? 0
  const filing: Filing | undefined =
    domainPrefix || !domains.data
      ? undefined
      : {
          domains: domains.data,
          file: (task, request) =>
            void session.file(
              task,
              request,
              (shown ?? []).map(({ id }) => id)
            )
        }
  return (
    <ListSessionContext.Provider value={session}>
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
              <TaskRow key={task.id} task={task} today={today} filing={filing} />
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
                  <TaskRow key={task.id} task={task} today={today} filing={filing} />
                ))}
              </ul>
            )}
          </div>
        )}
        {undoable && <UndoToast task={undoable} />}
      </section>
    </ListSessionContext.Provider>
  )
}
