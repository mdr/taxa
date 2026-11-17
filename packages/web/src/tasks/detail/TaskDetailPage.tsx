import { ChevronRight, Inbox, RotateCcw } from "lucide-react"
import { Link, useLocation } from "wouter"
import styles from "./TaskDetailPage.module.css"
import { taskDetailPageTestIds } from "./TaskDetailPageTestIds.ts"
import { ActivityList } from "./ActivityList.tsx"
import { NotesEditor } from "../../notes/NotesEditor.tsx"
import { TaskMenu } from "./TaskMenu.tsx"
import { TaskProperties } from "./TaskProperties.tsx"
import { TitleField } from "./TitleField.tsx"
import { problemMessage } from "../../api/problem-message.ts"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import { useDomains } from "../../domains/domain-queries.ts"
import { useTask } from "../task-queries.ts"
import { taskListPath } from "../task-list-path.ts"
import {
  FocusTarget,
  ShortcutGroup,
  ShortcutScope,
  useShortcutActions,
  useShortcuts
} from "../../shortcuts/shortcut-service.ts"
import { TaskChangeType, useTaskChanges, useTaskProblem, type TaskChange } from "../changes/task-changes-service.ts"

export const TaskDetailPage = ({ taskRef }: { taskRef: string }) => {
  const query = useTask(taskRef)
  const domains = useDomains()
  const { change: changeTask } = useTaskChanges()
  const problem = useTaskProblem(query.data?.id)
  const [, navigate] = useLocation()
  const { requestFocus } = useShortcutActions()
  const listPath = taskListPath(query.data, domains.data)
  useShortcuts(ShortcutScope.PAGE, [
    {
      keys: ["c"],
      description: "Add a task",
      group: ShortcutGroup.GENERAL,
      run: () => {
        navigate(listPath)
        requestFocus(FocusTarget.CAPTURE)
      }
    }
  ])
  if (query.isPending) return undefined
  if (query.isError) {
    return (
      <p className={styles.problem} role="alert" data-testid={taskDetailPageTestIds.error}>
        {problemMessage(query.error)}
      </p>
    )
  }
  const task = query.data
  const change = (taskChange: TaskChange): void => void changeTask(task, taskChange)
  const domain = domains.data?.find(({ id }) => id === task.domainId)
  return (
    <article className={styles.page} aria-labelledby="task-heading">
      <div className={styles.bar}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          {task.inbox ? (
            <Link href="/" className={styles.crumb}>
              <Inbox size={14} aria-hidden /> Inbox
            </Link>
          ) : (
            domain && (
              <Link href={`/domains/${domain.prefix}`} className={styles.crumb}>
                <DomainBadge prefix={domain.prefix} /> {domain.name}
              </Link>
            )
          )}
          <ChevronRight size={14} className={styles.separator} aria-hidden />
          <span className={styles.ref} data-testid={taskDetailPageTestIds.ref}>
            {task.ref}
          </span>
        </nav>
        <TaskMenu task={task} change={change} />
      </div>
      <h1 id="task-heading" className={styles.visuallyHidden}>
        {task.title}
      </h1>
      {task.deletedAt && (
        <p className={styles.deleted} data-testid={taskDetailPageTestIds.deleted}>
          This task is deleted.
          <button
            type="button"
            onClick={() => change({ type: TaskChangeType.RESTORE })}
            data-testid={taskDetailPageTestIds.restore}
          >
            <RotateCcw size={14} aria-hidden /> Restore
          </button>
        </p>
      )}
      <TitleField key={task.title} title={task.title} change={change} />
      <TaskProperties task={task} domains={domains.data ?? []} change={change} />
      {problem && (
        <p className={styles.problem} role="alert" data-testid={taskDetailPageTestIds.problem}>
          {problem}
        </p>
      )}
      <NotesEditor key={task.id} notes={task.notes} change={change} />
      <ActivityList taskId={task.id} domains={domains.data ?? []} />
    </article>
  )
}
