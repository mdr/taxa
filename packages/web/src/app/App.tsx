import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Route, Switch } from "wouter"
import styles from "./App.module.css"
import { appTestIds } from "./AppTestIds.ts"
import { Sidebar } from "./Sidebar.tsx"
import { TaskDetailPage } from "../tasks/detail/TaskDetailPage.tsx"
import { TaskListPage } from "../tasks/list/TaskListPage.tsx"

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

const NotFound = () => (
  <section data-testid={appTestIds.notFound}>
    <h1>Not found</h1>
    <p>There's nothing at this address.</p>
  </section>
)

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
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
      </main>
    </div>
  </QueryClientProvider>
)
