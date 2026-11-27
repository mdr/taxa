import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ChevronDown, RotateCcw } from "lucide-react"
import type { CSSProperties } from "react"
import styles from "./DoneButton.module.css"
import { doneButtonTestIds } from "./DoneButtonTestIds.ts"
import { useCelebrated, useListSession, useShownDone } from "../list/list-session-service.ts"
import { OptionList } from "../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../ui/Popover.tsx"
import { StatusIcon } from "../StatusIcon.tsx"
import { TaskChangeType, type TaskChange } from "../changes/task-changes-service.ts"

const SPARKS = 10

/** Taking back "done", whichever way it was done. */
const REOPEN = "REOPEN"

const Check = () => (
  <svg className={styles.check} viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
  </svg>
)

const Sparks = () => (
  <span className={styles.sparks} aria-hidden>
    {Array.from({ length: SPARKS }, (_, index) => (
      <i key={index} style={{ "--angle": `${(360 / SPARKS) * index}deg` } as CSSProperties} />
    ))}
  </span>
)

interface DoneButtonProps {
  task: Task
  change: (change: TaskChange) => void
}

/**
 * On a task's page: marks it done, the plainest thing to do with it, as
 * ticking its row does. Once it's done, a click doesn't quietly take that
 * back: it opens a menu saying what it would do, to reopen it or move it on.
 */
export const DoneButton = ({ task, change }: DoneButtonProps) => {
  const session = useListSession()
  const done = useShownDone(task)
  const celebrate = useCelebrated(task.id)
  if (task.deletedAt || task.status === TaskStatus.CANCELLED) return undefined
  if (done)
    return <Finished task={task} change={change} celebrate={celebrate} reopen={() => void session.toggle(task)} />
  const label = task.repeat ? "Done this time" : "Mark done"
  return (
    <button
      type="button"
      className={styles.done}
      onClick={() => void session.toggle(task)}
      aria-keyshortcuts="X"
      title={`${label} (X)`}
      data-testid={doneButtonTestIds.done}
      data-track="DoneButton.done"
    >
      <Check />
      {label}
      <kbd className={styles.key}>X</kbd>
    </button>
  )
}

const Finished = ({
  task,
  change,
  celebrate,
  reopen
}: DoneButtonProps & { celebrate: boolean; reopen: () => void }) => (
  <Popover
    label="Done: change status"
    look={PopoverLook.CHIP}
    triggerClassName={`${styles.done} ${styles.finished} ${celebrate ? styles.celebrating : ""}`}
    testId={doneButtonTestIds.finished}
    track="DoneButton.finished"
    trigger={
      <>
        <Check />
        Done
        <ChevronDown className={styles.chevron} size={15} aria-hidden />
        {celebrate && <Sparks />}
      </>
    }
    alignEnd
  >
    {(close) => (
      <OptionList
        track="DoneButton.status"
        options={[
          {
            value: REOPEN,
            // A repeating task is open again at its next date already: this takes back this time's tick.
            label: task.repeat ? "Not done this time" : "Reopen",
            detail: "X",
            icon: <RotateCcw size={15} aria-hidden />
          },
          ...(task.repeat
            ? []
            : [TaskStatus.IN_PROGRESS, TaskStatus.WAITING].map((status) => ({
                value: status,
                label: status === TaskStatus.IN_PROGRESS ? "In progress" : "Waiting",
                icon: <StatusIcon status={status} />
              })))
        ]}
        onChoose={(choice) => {
          close()
          if (choice === REOPEN) reopen()
          else change({ type: TaskChangeType.STATUS, request: { status: choice as TaskStatus } })
        }}
      />
    )}
  </Popover>
)
