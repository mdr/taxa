import styles from "./TaskListPage.module.css"
import { taskListPageTestIds } from "./TaskListPageTestIds.ts"
import { QuickCapture } from "./QuickCapture.tsx"
import { TaskRow } from "./TaskRow.tsx"
import { problemMessage } from "../../api/problem-message.ts"
import { useToday } from "../../dates/use-today.ts"
import { useDomains } from "../../domains/domain-queries.ts"
import { useTasks } from "../task-queries.ts"

/** A domain's tasks, or without a domain, the Inbox. */
export const TaskListPage = ({ domainPrefix }: { domainPrefix?: string }) => {
  const domains = useDomains()
  const tasks = useTasks(domainPrefix ? { domain: domainPrefix } : { inbox: "true" })
  const today = useToday()
  if (domains.data?.length === 0) {
    return (
      <section className={styles.page} data-testid={taskListPageTestIds.welcome}>
        <h1>Welcome to Taxa</h1>
        <p>Tasks live in domains, such as Home or Work. Add your first one in the sidebar to start.</p>
      </section>
    )
  }
  const domain = domains.data?.find(({ prefix }) => prefix === domainPrefix?.toUpperCase())
  return (
    <section className={styles.page} aria-labelledby="list-heading">
      <h1 id="list-heading" data-testid={taskListPageTestIds.heading}>
        {domainPrefix ? (domain?.name ?? domainPrefix) : "Inbox"}
      </h1>
      <QuickCapture domainPrefix={domain?.prefix} />
      {tasks.isPending ? (
        <p className={styles.quiet}>Loading…</p>
      ) : tasks.isError ? (
        <p role="alert" data-testid={taskListPageTestIds.error}>
          {problemMessage(tasks.error)}
        </p>
      ) : tasks.data.length === 0 ? (
        <p className={styles.quiet} data-testid={taskListPageTestIds.empty}>
          {domainPrefix ? "Nothing to do here." : "Nothing waiting to be organised."}
        </p>
      ) : (
        <ul className={styles.tasks}>
          {tasks.data.map((task) => (
            <TaskRow key={task.id} task={task} today={today} />
          ))}
        </ul>
      )}
    </section>
  )
}
