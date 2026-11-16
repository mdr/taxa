import { Link } from "wouter"
import styles from "./TaskDetailPage.module.css"
import { taskDetailPageTestIds } from "./TaskDetailPageTestIds.ts"
import { ActivityList } from "./ActivityList.tsx"
import { NotesEditor } from "./NotesEditor.tsx"
import { TaskFields } from "./TaskFields.tsx"
import { TitleField } from "./TitleField.tsx"
import { problemMessage } from "../../api/problem-message.ts"
import { useDomains } from "../../domains/domain-queries.ts"
import { useTask } from "../task-queries.ts"
import { TaskChangeType, useTaskChanges } from "../use-task-changes.ts"

export const TaskDetailPage = ({ taskRef }: { taskRef: string }) => {
  const query = useTask(taskRef)
  const domains = useDomains()
  const { change, problem } = useTaskChanges(query.data, taskRef)
  if (query.isPending) return <p>Loading…</p>
  if (query.isError) {
    return (
      <p role="alert" data-testid={taskDetailPageTestIds.error}>
        {problemMessage(query.error)}
      </p>
    )
  }
  const task = query.data
  const domain = domains.data?.find(({ id }) => id === task.domainId)
  return (
    <article className={styles.page} aria-labelledby="task-heading">
      <p className={styles.back}>
        <Link href={domain ? `/domains/${domain.prefix}` : "/"}>← {domain?.name ?? "Inbox"}</Link>
      </p>
      <h1 id="task-heading" className={styles.heading}>
        <span className={styles.ref} data-testid={taskDetailPageTestIds.ref}>
          {task.ref}
        </span>
        <span className={styles.visuallyHidden}>{task.title}</span>
      </h1>
      <TitleField key={task.title} title={task.title} change={change} />
      {problem && (
        <p className={styles.problem} role="alert" data-testid={taskDetailPageTestIds.problem}>
          {problem}
        </p>
      )}
      {task.deletedAt && (
        <p className={styles.deleted} data-testid={taskDetailPageTestIds.deleted}>
          This task is deleted.{" "}
          <button
            type="button"
            onClick={() => change({ type: TaskChangeType.RESTORE })}
            data-testid={taskDetailPageTestIds.restore}
          >
            Restore it
          </button>
        </p>
      )}
      <TaskFields key={`fields-${task.estimateMinutes}`} task={task} domains={domains.data ?? []} change={change} />
      <NotesEditor notes={task.notes} change={change} />
      <ActivityList taskId={task.id} />
      {!task.deletedAt && (
        <p>
          <button
            type="button"
            className={styles.delete}
            onClick={() => change({ type: TaskChangeType.DELETE })}
            data-testid={taskDetailPageTestIds.delete}
          >
            Delete task
          </button>
        </p>
      )}
    </article>
  )
}
