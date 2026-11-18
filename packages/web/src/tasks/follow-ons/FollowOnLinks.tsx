import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { When } from "@taxa/shared/tasks/when"
import { Link2, Plus, X } from "lucide-react"
import { useState } from "react"
import { Link } from "wouter"
import styles from "./FollowOn.module.css"
import { followOnLinksTestIds } from "./FollowOnLinksTestIds.ts"
import { useFollowOn } from "./follow-on-service.ts"
import { ShortcutGroup, ShortcutScope, useShortcuts } from "../../shortcuts/shortcut-service.ts"
import { Popover, PopoverLook } from "../../ui/Popover.tsx"
import { TaskChangeType, type TaskChange } from "../changes/task-changes-service.ts"
import { StatusIcon } from "../StatusIcon.tsx"
import { useTask, useTasks } from "../task-queries.ts"

/** Every task, whatever its status or when: what a task led to, or might follow on from. */
const EVERY = { status: Object.values(TaskStatus).join(","), when: Object.values(When).join(",") }

/** The most a search for a task to follow on from shows. */
const MOST_FOUND = 8

const TaskLink = ({ task, testId }: { task: Task; testId: string }) => (
  <Link href={`/tasks/${task.ref}`} className={styles.link} data-testid={testId}>
    <StatusIcon status={task.status} />
    <span className={styles.ref}>{task.ref}</span> <span className={styles.linkTitle}>{task.title}</span>
  </Link>
)

/** Finds a task to say this one follows on from. */
const FollowsOnPicker = ({
  task,
  change,
  close
}: {
  task: Task
  change: (change: TaskChange) => void
  close: () => void
}) => {
  const [search, setSearch] = useState("")
  const found = useTasks({ ...EVERY, search }, search.trim() !== "")
  const candidates = (found.data ?? []).filter(({ id }) => id !== task.id).slice(0, MOST_FOUND)
  return (
    <div className={styles.picker}>
      <input
        className={styles.search}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Find the earlier task…"
        aria-label="Find the earlier task"
        data-testid={followOnLinksTestIds.search}
      />
      <ul className={styles.candidates}>
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              className={styles.candidate}
              onClick={() => {
                close()
                change({ type: TaskChangeType.UPDATE, request: { set: { followsOn: candidate.id } } })
              }}
              data-testid={followOnLinksTestIds.candidate}
            >
              <StatusIcon status={candidate.status} />
              <span className={styles.ref}>{candidate.ref}</span>{" "}
              <span className={styles.linkTitle}>{candidate.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** On a task's page: what it follows on from, what it led to, and adding what comes next. */
export const FollowOnLinks = ({ task, change }: { task: Task; change: (change: TaskChange) => void }) => {
  const { start } = useFollowOn()
  const earlier = useTask(task.followsOnId ?? "", task.followsOnId !== undefined)
  const ledTo = useTasks({ ...EVERY, followsOn: task.id })
  useShortcuts(ShortcutScope.PAGE, [
    { keys: ["f"], description: "Add a follow-on task", group: ShortcutGroup.TASKS, run: () => start(task) }
  ])
  return (
    <section className={styles.links} aria-label="Follow-ons" data-testid={followOnLinksTestIds.links}>
      <div className={styles.linkRow}>
        <span className={styles.linkLabel}>Follows on from</span>
        {task.followsOnId !== undefined && earlier.data ? (
          <span className={styles.linked}>
            <TaskLink task={earlier.data} testId={followOnLinksTestIds.followsOn} />
            <button
              type="button"
              className={styles.unlink}
              onClick={() => change({ type: TaskChangeType.UPDATE, request: { clear: [ClearableField.FOLLOWS_ON] } })}
              aria-label={`Unlink from ${earlier.data.ref}`}
              data-testid={followOnLinksTestIds.unlink}
            >
              <X size={13} aria-hidden />
            </button>
          </span>
        ) : (
          <Popover
            label="Set follows on from"
            look={PopoverLook.EMPTY_CHIP}
            testId={followOnLinksTestIds.setFollowsOn}
            trigger={
              <>
                <Link2 size={13} aria-hidden /> Set…
              </>
            }
          >
            {(close) => <FollowsOnPicker task={task} change={change} close={close} />}
          </Popover>
        )}
      </div>
      <div className={styles.linkRow}>
        <span className={styles.linkLabel}>Led to</span>
        <span className={styles.ledTo}>
          {(ledTo.data ?? []).map((later) => (
            <TaskLink key={later.id} task={later} testId={followOnLinksTestIds.ledTo} />
          ))}
          <button
            type="button"
            className={styles.addFollowOn}
            onClick={() => start(task)}
            aria-keyshortcuts="F"
            data-testid={followOnLinksTestIds.addFollowOn}
          >
            <Plus size={13} aria-hidden /> Add follow-on
          </button>
        </span>
      </div>
    </section>
  )
}
