import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Route, Switch } from "wouter"
import styles from "./App.module.css"
import { appTestIds } from "./AppTestIds.ts"
import { Sidebar } from "./Sidebar.tsx"
import { TaskDetailPage } from "../tasks/detail/TaskDetailPage.tsx"
import { TaskListPage } from "../tasks/list/TaskListPage.tsx"
import { useDomains } from "../domains/domain-queries.ts"
import { Onboarding } from "../onboarding/Onboarding.tsx"
import { problemMessage } from "../api/problem-message.ts"

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

const NotFound = () => (
  <section data-testid={appTestIds.notFound}>
    <h1>Not found</h1>
    <p>There's nothing at this address.</p>
  </section>
)

const Pages = () => (
  <Switch>
    <Route path="/">
      <TaskListPage />
    </Route>
    <Route path="/domains/:prefix">{({ prefix }) => <TaskListPage key={prefix} domainPrefix={prefix} />}</Route>
    <Route path="/tasks/:ref">{({ ref }) => <TaskDetailPage key={ref} taskRef={ref} />}</Route>
    <Route>
      <NotFound />
    </Route>
  </Switch>
)

/** Until there's a domain to put tasks in, choosing some is all there is to do. */
const Layout = () => {
  const domains = useDomains()
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
    </div>
  )
}

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <Layout />
  </QueryClientProvider>
)
