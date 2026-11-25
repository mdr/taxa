import { ChecklistChangeType, type ChecklistItem, type ChecklistRequest } from "@taxa/shared/tasks/checklist"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CornerDownRight, GripVertical, X } from "lucide-react"
import { useState } from "react"
import { Link } from "wouter"
import styles from "./ChecklistItemRow.module.css"
import { checklistItemRowTestIds } from "./ChecklistItemRowTestIds.ts"

/** Rewording an item: Enter or leaving the field saves it, Escape keeps it as it was. */
const ItemField = ({ text, onDone }: { text: string; onDone: (text: string | undefined) => void }) => {
  const [draft, setDraft] = useState(text)
  const save = (): void => onDone(draft.trim() === "" || draft.trim() === text ? undefined : draft.trim())
  return (
    <input
      className={styles.edit}
      value={draft}
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- it opens where it was clicked, to be typed in
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) save()
        if (event.key === "Escape") onDone(undefined)
      }}
      aria-label="Checklist item"
      data-testid={checklistItemRowTestIds.edit}
      data-track="ChecklistItemRow.edit"
    />
  )
}

/** One step on a task's checklist: move it by its grip, tick it, reword it, make it a task, or take it off. */
export const ChecklistItemRow = ({
  item,
  done,
  change
}: {
  item: ChecklistItem
  /** As shown: ticked here and now, though the server's still to say so. */
  done: boolean
  change: (request: ChecklistRequest) => void
}) => {
  const [editing, setEditing] = useState(false)
  const { id, text, task } = item
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging } = useSortable({
    id
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={styles.item}
      data-done={done}
      data-dragging={isDragging}
      data-testid={checklistItemRowTestIds.item}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={styles.grip}
        {...attributes}
        {...listeners}
        aria-label={`Move “${text}”`}
        data-testid={checklistItemRowTestIds.grip}
        data-track="ChecklistItemRow.grip"
      >
        <GripVertical size={14} aria-hidden />
      </button>
      <input
        type="checkbox"
        className={styles.tick}
        checked={done}
        disabled={task !== undefined}
        title={task && `Ticked when ${task.ref} is done`}
        onChange={() => change({ type: ChecklistChangeType.TICK, item: id, done: !done })}
        aria-label={`Done: ${text}`}
        data-testid={checklistItemRowTestIds.tick}
        data-track="ChecklistItemRow.tick"
      />
      {editing ? (
        <ItemField
          text={text}
          onDone={(reworded) => {
            setEditing(false)
            if (reworded !== undefined) change({ type: ChecklistChangeType.RENAME, item: id, text: reworded })
          }}
        />
      ) : (
        <button
          type="button"
          className={styles.text}
          onClick={() => setEditing(true)}
          data-testid={checklistItemRowTestIds.text}
          data-track="ChecklistItemRow.startEditing"
        >
          {text}
        </button>
      )}
      {task && (
        <Link href={`/tasks/${task.ref}`} className={styles.ref} data-testid={checklistItemRowTestIds.taskRef}>
          {task.ref}
        </Link>
      )}
      <span className={styles.actions}>
        {!task && (
          <button
            type="button"
            className={styles.action}
            title="Make it a task of its own"
            aria-label={`Make “${text}” a task of its own`}
            onClick={() => change({ type: ChecklistChangeType.MAKE_TASK, item: id })}
            data-testid={checklistItemRowTestIds.makeTask}
            data-track="ChecklistItemRow.makeTask"
          >
            <CornerDownRight size={14} aria-hidden />
          </button>
        )}
        <button
          type="button"
          className={styles.action}
          title="Remove"
          aria-label={`Remove “${text}”`}
          onClick={() => change({ type: ChecklistChangeType.REMOVE, item: id })}
          data-testid={checklistItemRowTestIds.remove}
          data-track="ChecklistItemRow.remove"
        >
          <X size={14} aria-hidden />
        </button>
      </span>
    </li>
  )
}
