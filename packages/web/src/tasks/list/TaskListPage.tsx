import { TaskStatus } from "@taxa/shared/tasks/task"
import { ChevronDown, ChevronRight, Inbox, Search } from "lucide-react"
import { useEffect, useRef, useState, type Ref } from "react"
import styles from "./TaskListPage.module.css"
import { taskListPageTestIds } from "./TaskListPageTestIds.ts"
import { QuickCapture } from "./QuickCapture.tsx"
import { TaskRow, type Filing } from "./TaskRow.tsx"
import { UndoToast } from "./UndoToast.tsx"
import { withTicked } from "./with-ticked.ts"
import { listSearch } from "./list-search.ts"
import { ListSessionContext, ListSessionService } from "./list-session-service.ts"
import { listShortcuts } from "./list-shortcuts.ts"
import { useLocation } from "wouter"
import { realScheduler } from "../../services/scheduler.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { useServiceState } from "../../services/service-hooks.ts"
import { useTaskChanges } from "../changes/task-changes-service.ts"
import { ShortcutScope, useShortcuts } from "../../shortcuts/shortcut-service.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { useToday } from "../../dates/use-today.ts"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import { useDomains } from "../../domains/domain-queries.ts"
import { useTasks } from "../task-queries.ts"
import { StatusIcon } from "../StatusIcon.tsx"
import { isHome, listQuery, ListType, type TaskList } from "./task-list.ts"

/** Finds tasks in the list as you type; Escape clears it and leaves. */
const ListSearch = ({
  value,
  onSearch,
  input
}: {
  value: string
  onSearch: (text: string) => void
  input: Ref<HTMLInputElement>
}) => (
  <label className={styles.searchBox}>
    <Search size={15} aria-hidden />
    <input
      ref={input}
      type="search"
      className={styles.search}
      value={value}
      onChange={(event) => onSearch(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        onSearch("")
        event.currentTarget.blur()
      }}
      placeholder="Search"
      aria-label="Search the list"
      data-testid={taskListPageTestIds.search}
    />
  </label>
)

const HEADINGS: Record<ListType, string | undefined> = {
  [ListType.INBOX]: "Inbox",
  [ListType.DOMAIN]: undefined,
  [ListType.IN_PROGRESS]: "In progress"
}

/** A list of tasks: the Inbox, a domain's, or everything in progress. */
export const TaskListPage = ({ list }: { list: TaskList }) => {
  const domainPrefix = list.type === ListType.DOMAIN ? list.prefix : undefined
  const home = isHome(list)
  // A session for each visit: the routes give each list its own page.
  const changes = useTaskChanges()
  const [session] = useState(() => new ListSessionService(changes, realScheduler, appAnalytics))
  useEffect(() => session.dispose, [session])
  const ticked = useServiceState(session, (state) => state.ticked)
  const undoable = useServiceState(session, (state) => state.undoable)
  const search = useServiceState(session, (state) => state.search)
  const searchBox = useRef<HTMLInputElement>(null)
  const domains = useDomains()
  const query = listQuery(list)
  const tasks = useTasks(query)
  const completed = useTasks({ ...query, status: TaskStatus.DONE }, home)
  const today = useToday()
  const [showCompleted, setShowCompleted] = useState(false)
  const domain = domains.data?.find(({ prefix }) => prefix === domainPrefix?.toUpperCase())
  const found = listSearch(
    tasks.data ? withTicked(tasks.data, ticked) : undefined,
    (completed.data ?? []).filter(({ id }) => ticked[id] === undefined),
    search,
    showCompleted
  )
  const { open: shown, completed: earlierFound, completedOpen } = found
  const [, navigate] = useLocation()
  useShortcuts(
    ShortcutScope.PAGE,
    listShortcuts(
      [...(shown ?? []), ...(completedOpen ? earlierFound : [])],
      session,
      (task) => navigate(`/tasks/${task.ref}`),
      () => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      },
      () => searchBox.current?.focus()
    )
  )
  const openCount = tasks.data?.length ?? 0
  const filing: Filing | undefined =
    list.type !== ListType.INBOX || !domains.data
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
          {list.type === ListType.DOMAIN && domain && <DomainBadge prefix={domain.prefix} />}
          {list.type === ListType.INBOX && <Inbox size={22} className={styles.icon} aria-hidden />}
          {list.type === ListType.IN_PROGRESS && <StatusIcon status={TaskStatus.IN_PROGRESS} size={22} />}
          <h1 id="list-heading" className={styles.heading} data-testid={taskListPageTestIds.heading}>
            {HEADINGS[list.type] ?? domain?.name ?? domainPrefix}
          </h1>
          {openCount > 0 && <span className={styles.count}>{openCount}</span>}
          <ListSearch value={search} onSearch={session.search} input={searchBox} />
        </header>
        {home && <QuickCapture domainPrefix={domain?.prefix} />}
        {tasks.isError ? (
          <p className={styles.problem} role="alert" data-testid={taskListPageTestIds.error}>
            {problemMessage(tasks.error)}
          </p>
        ) : found.noMatches ? (
          <p className={styles.noMatches} data-testid={taskListPageTestIds.noMatches}>
            {found.noMatches}
          </p>
        ) : shown?.length === 0 ? (
          <div className={styles.empty} data-testid={taskListPageTestIds.empty}>
            {list.type === ListType.DOMAIN && <p>Nothing to do here. Enjoy it.</p>}
            {list.type === ListType.INBOX && (
              <>
                <p className={styles.emptyTitle}>Your Inbox is clear</p>
                <p>Capture anything above as it occurs to you, and file it into a domain later.</p>
              </>
            )}
            {list.type === ListType.IN_PROGRESS && (
              <>
                <p className={styles.emptyTitle}>Nothing in progress</p>
                <p>Press I on a task to start working on it, and it shows here until you stop.</p>
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
        {earlierFound.length > 0 && (
          <div className={styles.completed}>
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={completedOpen}
              onClick={() => {
                if (!completedOpen)
                  appAnalytics.track(ANALYTICS_CODES.list.completedShown, "showed completed tasks", {
                    domainPrefix: domain?.prefix
                  })
                setShowCompleted(!completedOpen)
              }}
              data-testid={taskListPageTestIds.showCompleted}
            >
              {completedOpen ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
              {earlierFound.length} completed
            </button>
            {completedOpen && (
              <ul className={styles.tasks} data-testid={taskListPageTestIds.completed}>
                {earlierFound.map((task) => (
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
