import { OccurrenceStrip } from "./OccurrenceStrip.tsx"
import { Checklist } from "../checklist/Checklist.tsx"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { ChevronRight, Inbox, Layers, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
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
import { FollowOnLinks } from "../follow-ons/FollowOnLinks.tsx"
import { START_OR_STOP, startedOrStopped } from "../in-progress.ts"
import { ListSessionContext, ListSessionService } from "../list/list-session-service.ts"
import { UndoToast } from "../list/UndoToast.tsx"
import { useServiceState } from "../../services/service-hooks.ts"
import { realScheduler } from "../../services/scheduler.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { useUndo } from "../../undo/undo-service.ts"
import { FileButton } from "../filing/FileButton.tsx"
import { DoneButton } from "./DoneButton.tsx"
import { filedRequest } from "../filing/filing.ts"

export const TaskDetailPage = ({ taskRef }: { taskRef: string }) => {
  const query = useTask(taskRef)
  const domains = useDomains()
  const changes = useTaskChanges()
  const { change: changeTask } = changes
  // Marking it done here offers to undo it, or add what follows on, as ticking it off in a list does.
  const history = useUndo()
  const [session] = useState(() => new ListSessionService(changes, history, realScheduler, appAnalytics))
  useEffect(() => session.dispose, [session])
  const undoable = useServiceState(session, (state) => state.undoable)
  const undoes = useServiceState(session, (state) => state.undoes)
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
    },
    { keys: ["Escape"], description: "Back to the list", group: ShortcutGroup.GO, run: () => navigate(listPath) },
    {
      keys: ["mod+z"],
      description: "Undo the last change",
      group: ShortcutGroup.GENERAL,
      run: () => void session.undo()
    },
    {
      keys: ["v"],
      description: "File it, or put it back in the Inbox",
      group: ShortcutGroup.TASKS,
      available: () => query.data !== undefined,
      run: () => {
        if (query.data) void changeTask(query.data, { type: TaskChangeType.UPDATE, request: filedRequest(query.data) })
      }
    },
    {
      keys: ["x"],
      description: "Mark it done, or take that back",
      group: ShortcutGroup.TASKS,
      available: () => query.data !== undefined,
      run: () => {
        if (query.data) void session.toggle(query.data)
      }
    },
    { keys: ["r"], description: "Rename", group: ShortcutGroup.TASKS, run: () => requestFocus(FocusTarget.TITLE) },
    { keys: ["n"], description: "Write notes", group: ShortcutGroup.TASKS, run: () => requestFocus(FocusTarget.NOTES) },
    {
      keys: ["i"],
      description: START_OR_STOP,
      group: ShortcutGroup.TASKS,
      available: () => query.data !== undefined && startedOrStopped(query.data.status) !== undefined,
      run: () => {
        const status = query.data && startedOrStopped(query.data.status)
        if (query.data && status) void changeTask(query.data, { type: TaskChangeType.STATUS, request: { status } })
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
  const change = (taskChange: TaskChange): void => {
    const done = taskChange.type === TaskChangeType.STATUS && taskChange.request.status === TaskStatus.DONE
    void (done ? session.complete(task) : changeTask(task, taskChange))
  }
  const domain = domains.data?.find(({ id }) => id === task.domainId)
  return (
    <ListSessionContext.Provider value={session}>
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
                  {(domains.data ?? []).length > 1 ? (
                    <>
                      <DomainBadge prefix={domain.prefix} /> {domain.name}
                    </>
                  ) : (
                    <>
                      <Layers size={14} aria-hidden /> All tasks
                    </>
                  )}
                </Link>
              )
            )}
            <ChevronRight size={14} className={styles.separator} aria-hidden />
            <span className={styles.ref} data-testid={taskDetailPageTestIds.ref}>
              {task.ref}
            </span>
          </nav>
          <div className={styles.actions}>
            <DoneButton task={task} />
            <TaskMenu task={task} change={change} />
          </div>
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
              data-track="TaskDetailPage.restore"
            >
              <RotateCcw size={14} aria-hidden /> Restore
            </button>
          </p>
        )}
        {task.inbox && !task.deletedAt && (
          <p className={styles.inbox} data-testid={taskDetailPageTestIds.inbox}>
            In your Inbox, to sort out: fill it in, then file it.
            <FileButton
              task={task}
              testId={taskDetailPageTestIds.file}
              track="TaskDetailPage.file"
              onFile={() => change({ type: TaskChangeType.UPDATE, request: filedRequest(task) })}
            />
          </p>
        )}
        <TitleField key={task.title} title={task.title} change={change} />
        <TaskProperties task={task} domains={domains.data ?? []} change={change} />
        <FollowOnLinks task={task} change={change} />
        {task.repeat && <OccurrenceStrip task={task} />}
        {problem && (
          <p className={styles.problem} role="alert" data-testid={taskDetailPageTestIds.problem}>
            {problem}
          </p>
        )}
        <NotesEditor key={task.id} notes={task.notes} change={change} />
        <Checklist key={`${task.id}-checklist`} task={task} change={change} />
        <ActivityList key={`${task.id}-timeline`} task={task} domains={domains.data ?? []} change={change} />
        {undoable && <UndoToast task={undoable} undoes={undoes} />}
      </article>
    </ListSessionContext.Provider>
  )
}
