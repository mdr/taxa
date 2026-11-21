import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { TaskId } from "@taxa/shared/ids"
import { ChevronDown, ChevronRight, Search } from "lucide-react"
import { useEffect, useRef, useState, type Ref } from "react"
import styles from "./TaskListPage.module.css"
import { taskListPageTestIds } from "./TaskListPageTestIds.ts"
import { QuickCapture } from "./QuickCapture.tsx"
import { TaskRow, type Filing } from "./row/TaskRow.tsx"
import { UndoToast } from "./UndoToast.tsx"
import { withTicked } from "./with-ticked.ts"
import { listSearch } from "./list-search.ts"
import { ListSessionContext, ListSessionService } from "./list-session-service.ts"
import { listShortcuts } from "./list-shortcuts.ts"
import { Link, useLocation } from "wouter"
import { PLAN_TODAY_PATH } from "../when/when-paths.ts"
import { TodayAttention } from "../../days/TodayAttention.tsx"
import { TagRename } from "../../tags/TagRename.tsx"
import { useFollowOn } from "../follow-ons/follow-on-service.ts"
import { realScheduler } from "../../services/scheduler.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { useServiceState } from "../../services/service-hooks.ts"
import { useTaskChanges } from "../changes/task-changes-service.ts"
import { ShortcutScope, useShortcuts } from "../../shortcuts/shortcut-service.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { useToday } from "../../dates/use-today.ts"
import { useDomains } from "../../domains/domain-queries.ts"
import { useTasks } from "../task-queries.ts"
import { EmptyList, ListIcon, listHeading, listWhen } from "./ListLooks.tsx"
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
  const undoes = useServiceState(session, (state) => state.undoes)
  const search = useServiceState(session, (state) => state.search)
  const searchBox = useRef<HTMLInputElement>(null)
  /** The order the list was last shown in, to keep ticked tasks in their places. */
  const lastShown = useRef<readonly TaskId[]>([])
  const domains = useDomains()
  const query = listQuery(list)
  const tasks = useTasks(query)
  const completed = useTasks({ ...query, status: TaskStatus.DONE }, home)
  const today = useToday()
  const [showCompleted, setShowCompleted] = useState(false)
  const domain = domains.data?.find(({ prefix }) => prefix === domainPrefix?.toUpperCase())
  const found = listSearch(
    tasks.data ? withTicked(tasks.data, ticked, lastShown.current) : undefined,
    (completed.data ?? []).filter(({ id }) => ticked[id] === undefined),
    search,
    showCompleted
  )
  const { open: shown, completed: earlierFound, completedOpen } = found
  useEffect(() => {
    lastShown.current = (shown ?? []).map(({ id }) => id)
  })
  const [, navigate] = useLocation()
  const { start: startFollowOn } = useFollowOn()
  const openCount = tasks.data?.length ?? 0
  const remove = (task: Task): void =>
    void session.delete(
      task,
      (shown ?? []).map(({ id }) => id)
    )
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
  useShortcuts(
    ShortcutScope.PAGE,
    listShortcuts(
      [...(shown ?? []), ...(completedOpen ? earlierFound : [])],
      session,
      {
        open: (task) => navigate(`/tasks/${task.ref}`),
        followOn: startFollowOn,
        remove,
        filedFromRow: (task) => filing !== undefined && task.inbox
      },
      () => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      },
      () => searchBox.current?.focus()
    )
  )
  return (
    <ListSessionContext.Provider value={session}>
      <section className={styles.page} aria-labelledby="list-heading">
        <header className={styles.header}>
          <ListIcon list={list} domain={domain} />
          <h1 id="list-heading" className={styles.heading} data-testid={taskListPageTestIds.heading}>
            {listHeading(list, domain)}
          </h1>
          {openCount > 0 && <span className={styles.count}>{openCount}</span>}
          <ListSearch value={search} onSearch={session.search} input={searchBox} />
          {list.type === ListType.TAG && <TagRename name={list.name} />}
          {/* Empty, Today offers planning as its main action instead. */}
          {list.type === ListType.TODAY && shown?.length !== 0 && (
            <Link href={PLAN_TODAY_PATH} className={styles.planToday} data-testid={taskListPageTestIds.planToday}>
              Plan today
            </Link>
          )}
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
            <EmptyList list={list} />
          </div>
        ) : (
          <ul className={styles.tasks} data-testid={taskListPageTestIds.tasks}>
            {shown?.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                domains={domains.data ?? []}
                filing={filing}
                listedBy={listWhen(list)}
                listedTag={list.type === ListType.TAG ? list.name : undefined}
                onDelete={remove}
              />
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
                  <TaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    domains={domains.data ?? []}
                    filing={filing}
                    onDelete={remove}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
        {list.type === ListType.TODAY && !search && <TodayAttention />}
        {undoable && <UndoToast task={undoable} undoes={undoes} />}
      </section>
    </ListSessionContext.Provider>
  )
}
