import {
  ChecklistChangeType,
  checklistProgress,
  itemsFromText,
  progressText,
  type ChecklistRequest
} from "@taxa/shared/tasks/checklist"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ListChecks } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { TaskChangeType, type TaskChange } from "../changes/task-changes-service.ts"
import styles from "./Checklist.module.css"
import { checklistTestIds } from "./ChecklistTestIds.ts"
import { ChecklistItems } from "./ChecklistItems.tsx"

/** The box for adding items: Enter adds one, and a pasted list adds a line each. */
const AddItem = ({ empty, add }: { empty: boolean; add: (texts: string[]) => void }) => {
  const [draft, setDraft] = useState("")
  const submit = (text: string): void => {
    const texts = itemsFromText(text)
    if (texts.length > 0) add(texts)
    setDraft("")
  }
  return (
    <input
      className={styles.add}
      value={draft}
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- shown when asked for, to type the first item
      autoFocus={empty}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) submit(draft)
        if (event.key === "Escape") event.currentTarget.blur()
      }}
      onPaste={(event) => {
        const pasted = event.clipboardData.getData("text")
        if (!pasted.includes("\n")) return
        event.preventDefault()
        submit(`${draft}${pasted}`)
      }}
      placeholder={empty ? "Add the first item, or paste a list" : "Add an item"}
      aria-label="Add a checklist item"
      data-testid={checklistTestIds.add}
      data-track="Checklist.add"
    />
  )
}

/**
 * A task's checklist: its steps, ticked off as they're done, how far through
 * it is, and, once every one's ticked, the offer to mark the task done.
 */
export const Checklist = ({ task, change }: { task: Task; change: (change: TaskChange) => void }) => {
  const [started, setStarted] = useState(false)
  // Ticks shown at once, until the task as the server has it says so too.
  const [ticking, setTicking] = useState<Readonly<Record<string, boolean>>>({})
  const version = useRef(task.version)
  useEffect(() => {
    if (version.current === task.version) return
    version.current = task.version
    setTicking({})
  }, [task.version])
  const changeChecklist = (request: ChecklistRequest): void => {
    if (request.type === ChecklistChangeType.TICK) setTicking((shown) => ({ ...shown, [request.item]: request.done }))
    change({ type: TaskChangeType.CHECKLIST, request })
  }
  const add = (texts: string[]): void => changeChecklist({ type: ChecklistChangeType.ADD, texts })
  const items = task.checklist.map((item) => ({ item, done: ticking[item.id] ?? item.done }))
  if (items.length === 0 && !started)
    return (
      <button
        type="button"
        className={styles.start}
        onClick={() => setStarted(true)}
        data-testid={checklistTestIds.start}
        data-track="Checklist.start"
      >
        <ListChecks size={15} aria-hidden /> Add a checklist
      </button>
    )
  const progress = checklistProgress(items)
  const finished = progress.total > 0 && progress.done === progress.total && task.status !== TaskStatus.DONE
  return (
    <section className={styles.checklist} aria-labelledby="checklist-heading" data-testid={checklistTestIds.checklist}>
      <div className={styles.top}>
        <h2 id="checklist-heading" className={styles.heading}>
          Checklist
        </h2>
        {progress.total > 0 && (
          <span className={styles.count} data-testid={checklistTestIds.progress}>
            {progressText(progress)}
          </span>
        )}
      </div>
      {progress.total > 0 && (
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="Checklist progress"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
        >
          <span style={{ width: `${(100 * progress.done) / progress.total}%` }} />
        </div>
      )}
      <ChecklistItems items={items} version={task.version} change={changeChecklist} />
      <AddItem empty={items.length === 0} add={add} />
      {finished && (
        <p className={styles.finished} role="status" data-testid={checklistTestIds.finished}>
          Everything's ticked off.
          <button
            type="button"
            className={styles.markDone}
            onClick={() => change({ type: TaskChangeType.STATUS, request: { status: TaskStatus.DONE } })}
            data-testid={checklistTestIds.markDone}
            data-track="Checklist.markDone"
          >
            Mark {task.ref} done
          </button>
        </p>
      )}
    </section>
  )
}
