import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "./query-client.ts"
import { tagFromPath } from "../tags/tag-paths.ts"
import { useEffect, useState } from "react"
import { Route, Switch, useLocation } from "wouter"
import styles from "./App.module.css"
import { appTestIds } from "./AppTestIds.ts"
import { Sidebar } from "./Sidebar.tsx"
import { TaskDetailPage } from "../tasks/detail/TaskDetailPage.tsx"
import { TaskListPage } from "../tasks/list/TaskListPage.tsx"
import { ListType, type TaskList } from "../tasks/list/task-list.ts"
import { IN_PROGRESS_PATH } from "../tasks/in-progress.ts"
import { PLAN_TODAY_PATH, SOMEDAY_PATH, SOON_PATH, TODAY_PATH } from "../tasks/when/when-paths.ts"
import { DayPlanPage } from "../days/DayPlanPage.tsx"
import { SessionPage } from "../sessions/SessionPage.tsx"
import { SessionSummary } from "../sessions/run/SessionSummary.tsx"
import { SESSION_PATH } from "../sessions/session-paths.ts"
import { SessionPlanContext, SessionPlanService } from "../sessions/plan/session-plan-service.ts"
import { sessionChanged } from "../sessions/session-queries.ts"
import { realClock } from "@taxa/shared/clock"

const INBOX_LIST: TaskList = { type: ListType.INBOX }
const IN_PROGRESS_LIST: TaskList = { type: ListType.IN_PROGRESS }
const TODAY_LIST: TaskList = { type: ListType.TODAY }
const SOON_LIST: TaskList = { type: ListType.SOON }
const SOMEDAY_LIST: TaskList = { type: ListType.SOMEDAY }
import { useDomains } from "../domains/domain-queries.ts"
import { Onboarding } from "../onboarding/Onboarding.tsx"
import { problemMessage } from "../api/problem-message.ts"
import { taxaApi } from "../api/taxa-api.ts"
import { ChangeOrder } from "../tasks/changes/change-order.ts"
import { queryCommentCache } from "../tasks/comments/comment-cache.ts"
import { queryTaskCache } from "../tasks/changes/task-cache.ts"
import { TaskChangesContext, TaskChangesService, useTaskChanges } from "../tasks/changes/task-changes-service.ts"
import { realScheduler } from "../services/scheduler.ts"
import { appAnalytics, appLogger } from "../telemetry/app-telemetry.ts"
import { useUiTracking } from "../telemetry/ui-tracking.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"
import { pageOpened } from "../telemetry/page-opened.ts"
import { appShortcuts } from "../shortcuts/app-shortcuts.ts"
import { ShortcutsHelp } from "../shortcuts/ShortcutsHelp.tsx"
import { CommandMenu } from "../shortcuts/CommandMenu.tsx"
import { SequenceHint } from "../shortcuts/SequenceHint.tsx"
import { localShortcutSettings } from "../shortcuts/shortcut-settings.ts"
import { FollowOnDialog } from "../tasks/follow-ons/FollowOnDialog.tsx"
import { UndoNotice } from "../undo/UndoNotice.tsx"
import { BinPage } from "../tasks/bin/BinPage.tsx"
import { BIN_PATH } from "../tasks/bin/bin-path.ts"
import { UndoContext, UndoService, useUndo, useUndoNotice } from "../undo/undo-service.ts"
import { FollowOnContext, FollowOnService, useFollowingOn } from "../tasks/follow-ons/follow-on-service.ts"
import {
  ShortcutContext,
  ShortcutScope,
  ShortcutService,
  useHelpOpen,
  useMenuOpen,
  useKeyboardShortcuts,
  useShortcutActions,
  useShortcuts
} from "../shortcuts/shortcut-service.ts"

const NotFound = () => (
  <section data-testid={appTestIds.notFound}>
    <h1>Not found</h1>
    <p>There's nothing at this address.</p>
  </section>
)

const Pages = () => (
  <Switch>
    <Route path="/">
      <TaskListPage key="INBOX" list={INBOX_LIST} />
    </Route>
    <Route path={IN_PROGRESS_PATH}>
      <TaskListPage key="IN_PROGRESS" list={IN_PROGRESS_LIST} />
    </Route>
    <Route path={TODAY_PATH}>
      <TaskListPage key="TODAY" list={TODAY_LIST} />
    </Route>
    <Route path={PLAN_TODAY_PATH}>
      <DayPlanPage />
    </Route>
    <Route path={SOON_PATH}>
      <TaskListPage key="SOON" list={SOON_LIST} />
    </Route>
    <Route path={SOMEDAY_PATH}>
      <TaskListPage key="SOMEDAY" list={SOMEDAY_LIST} />
    </Route>
    <Route path="/domains/:prefix">
      {({ prefix }) => <TaskListPage key={prefix} list={{ type: ListType.DOMAIN, prefix }} />}
    </Route>
    <Route path="/tags/:name">
      {({ name }) => <TaskListPage key={`TAG:${name}`} list={{ type: ListType.TAG, name: tagFromPath(name) }} />}
    </Route>
    <Route path={BIN_PATH}>
      <BinPage />
    </Route>
    <Route path="/tasks/:ref">{({ ref }) => <TaskDetailPage key={ref} taskRef={ref} />}</Route>
    <Route path={SESSION_PATH}>
      <SessionPage />
    </Route>
    <Route path="/sessions/:id">{({ id }) => <SessionSummary key={id} id={id} />}</Route>
    <Route>
      <NotFound />
    </Route>
  </Switch>
)

/** Until there's a domain to put tasks in, choosing some is all there is to do. */
const Layout = () => {
  const domains = useDomains()
  const [location, navigate] = useLocation()
  const { clearProblems } = useTaskChanges()
  // A refused change is about the page it was made on.
  useEffect(() => clearProblems(), [location, clearProblems])
  useEffect(
    () => appAnalytics.track(ANALYTICS_CODES.nav.pageOpened, `opened ${location}`, pageOpened(location)),
    [location]
  )
  const shortcuts = useShortcutActions()
  const helpOpen = useHelpOpen()
  const menuOpen = useMenuOpen()
  const followingOn = useFollowingOn()
  const history = useUndo()
  const undoNotice = useUndoNotice()
  useShortcuts(ShortcutScope.APP, appShortcuts(location, navigate, shortcuts, history))
  if (domains.data?.length === 0) {
    return (
      <main className={styles.onboarding}>
        <Onboarding />
      </main>
    )
  }
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        {domains.isSuccess && <Pages />}
        {domains.isError && <p role="alert">{problemMessage(domains.error)}</p>}
      </main>
      {helpOpen && <ShortcutsHelp />}
      {menuOpen && <CommandMenu />}
      <SequenceHint />
      {followingOn && <FollowOnDialog key={followingOn.id} from={followingOn} />}
      {undoNotice && <UndoNotice notice={undoNotice} />}
    </div>
  )
}

export const App = () => {
  const [order] = useState(() => new ChangeOrder())
  const [undo] = useState(
    () =>
      new UndoService(
        taxaApi,
        queryTaskCache(queryClient),
        queryCommentCache(queryClient),
        appAnalytics,
        realScheduler,
        order
      )
  )
  const [taskChanges] = useState(
    () => new TaskChangesService(taxaApi, queryTaskCache(queryClient), appAnalytics, appLogger, undo, order)
  )
  const [shortcuts] = useState(() => new ShortcutService(realScheduler, localShortcutSettings, appAnalytics))
  // Here, not on the planner's page, so a plan being made survives a look at one of its tasks.
  const [sessionPlan] = useState(
    () => new SessionPlanService(taxaApi, realClock, appAnalytics, (session) => sessionChanged(queryClient, session))
  )
  const [followOn] = useState(() => new FollowOnService(appAnalytics))
  useUiTracking(appAnalytics)
  useEffect(() => shortcuts.dispose, [shortcuts])
  useEffect(() => undo.dispose, [undo])
  useKeyboardShortcuts(shortcuts)
  return (
    <QueryClientProvider client={queryClient}>
      <UndoContext.Provider value={undo}>
        <TaskChangesContext.Provider value={taskChanges}>
          <SessionPlanContext.Provider value={sessionPlan}>
            <ShortcutContext.Provider value={shortcuts}>
              <FollowOnContext.Provider value={followOn}>
                <Layout />
              </FollowOnContext.Provider>
            </ShortcutContext.Provider>
          </SessionPlanContext.Provider>
        </TaskChangesContext.Provider>
      </UndoContext.Provider>
    </QueryClientProvider>
  )
}
