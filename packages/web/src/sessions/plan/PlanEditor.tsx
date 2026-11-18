import {
  closestCenter,
  DndContext,
  pointerWithin,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type Over,
  type DraggableSyntheticListeners,
  type UniqueIdentifier
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type SortingStrategy
} from "@dnd-kit/sortable"
import { CSS, getEventCoordinates } from "@dnd-kit/utilities"
import type { TaskId } from "@taxa/shared/ids"
import type { Task, TaskStatus } from "@taxa/shared/tasks/task"
import type { Minutes } from "@taxa/shared/units"
import { GripVertical, Plus, X } from "lucide-react"
import { useState, type KeyboardEventHandler, type ReactNode } from "react"
import styles from "./PlanEditor.module.css"
import { planEditorTestIds } from "./PlanEditorTestIds.ts"
import { suggestionReason } from "./suggestions.ts"
import { minutesText } from "../session-text.ts"
import { useToday } from "../../dates/use-today.ts"
import { StatusIcon } from "../../tasks/StatusIcon.tsx"
import { TaskEstimate } from "./TaskEstimate.tsx"
import { Link } from "wouter"

export interface PlanRow {
  task: Task
  minutes: Minutes
  /** When it's planned for: `2:30 – 3:15`. */
  span: string
  /** Finished: it stays where it is, as it is. */
  locked: boolean
  /** The task under way: it can move, and what's put above it is started instead. */
  underWay?: boolean
  /** Shown with its status icon, for a session under way. */
  status?: TaskStatus
  detail?: string
}

export interface PlanEditorProps {
  rows: readonly PlanRow[]
  suggestions: readonly Task[]
  search: string
  onSearch: (search: string) => void
  /** Adds a task at a place among the tasks that can move, or at the end. */
  onAdd: (task: Task, at?: number) => void
  onRemove: (taskId: TaskId) => void
  /** Moves a task to a place among the tasks that can move. */
  onMove: (taskId: TaskId, to: number) => void
  /** A planned task's estimate has been changed, and saved: the task as it now is. */
  onEstimated: (task: Task) => void
  /** While a change is being saved. */
  busy?: boolean
}

/** Drag ids: a suggestion's is marked as one, a planned task's is its id, and the plan column takes drops at its end. */
const SUGGESTION = "suggestion:"
const PLAN_END = "plan-end"
/** A planned task dragged back here comes out of the plan. */
const SUGGESTIONS = "suggestions"

/**
 * With a mouse or finger, only what's under the pointer: a row before the
 * column it's in, and nothing at all elsewhere, so letting go there puts it
 * back. With the keyboard, which has no pointer, the nearest row.
 */
const underPointer: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args)
  const hits = pointerWithin(args)
  const rows = hits.filter(({ id }) => id !== PLAN_END && id !== SUGGESTIONS)
  return rows.length > 0 ? rows : hits
}

/** Whether the pointer is in the lower half of what it's over: a suggestion dropped there goes after it, not before. */
const inLowerHalf = ({ activatorEvent, delta, over }: DragMoveEvent | DragEndEvent): boolean => {
  const start = getEventCoordinates(activatorEvent)
  if (!start || !over) return false
  return start.y + delta.y > over.rect.top + over.rect.height / 2
}

/** Planned tasks make room for one moved among them; a suggestion coming in shows where it'll go with a line instead, so the rows stay under the pointer. */
const makeRoom: SortingStrategy = (args) =>
  // oxlint-disable-next-line eslint-js/no-restricted-syntax -- the library's "no change"
  args.activeIndex < 0 ? null : verticalListSortingStrategy(args)

const suggestionDragId = (taskId: TaskId): string => `${SUGGESTION}${taskId}`

/** Drag by mouse or touch anywhere on a row; the keyboard only from a grip, so keys on the row's own buttons stay theirs. */
const pointerOnly = (listeners: DraggableSyntheticListeners) => {
  const { onKeyDown: _keys, ...rest } = listeners ?? {}
  return rest
}

/** The keyboard half of a row's drag handlers, for its grip. */
const keyHandler = (listeners: DraggableSyntheticListeners): KeyboardEventHandler | undefined =>
  listeners?.["onKeyDown"] as KeyboardEventHandler | undefined

/** The task's title, going to its page; not dragged as a link, so dragging moves the row. */
const TaskLink = ({ task }: { task: Task }) => (
  <Link href={`/tasks/${task.ref}`} className={styles.taskLink} draggable={false}>
    {task.title}
  </Link>
)

const SuggestionRow = ({ task, busy, onAdd }: { task: Task; busy: boolean; onAdd: (task: Task) => void }) => {
  const today = useToday()
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: suggestionDragId(task.id), data: { task } })
  const reason = suggestionReason(task, today)
  return (
    <li
      ref={setNodeRef}
      className={`${styles.row} ${styles.draggable} ${isDragging ? styles.dragging : ""}`}
      data-testid={planEditorTestIds.suggestion}
      {...pointerOnly(listeners)}
    >
      {/* A cue that it drags, as the plan's rows have; the add button is the way in without dragging. */}
      <span className={`${styles.grip} ${styles.gripCue}`} aria-hidden>
        <GripVertical size={14} />
      </span>
      <button
        type="button"
        className={`${styles.iconButton} ${styles.add}`}
        onClick={() => onAdd(task)}
        disabled={busy}
        aria-label={`Add ${task.title}`}
        data-testid={planEditorTestIds.add}
      >
        <Plus size={14} aria-hidden />
      </button>
      <span className={styles.title}>
        <span className={styles.titleText} data-testid={planEditorTestIds.suggestionTitle}>
          <TaskLink task={task} />
        </span>
        <span className={styles.detail}>
          <span className={styles.ref}>{task.ref}</span>
          {reason && <span className={styles.reason}>{reason}</span>}
        </span>
      </span>
      <TaskEstimate task={task} testId={planEditorTestIds.estimate} />
    </li>
  )
}

interface PlanRowItemProps {
  row: PlanRow
  busy: boolean
  /** Where a suggestion over this row would go: after it, rather than before. */
  dropAfter: boolean
  onRemove: (taskId: TaskId) => void
  onEstimated: (task: Task) => void
}

/** Finished: it stays where it is, out of the dragging. */
const LockedRow = ({ row: { task, minutes, span, status, detail } }: { row: PlanRow }) => (
  <li className={`${styles.row} ${styles.locked}`} data-testid={planEditorTestIds.row}>
    <span className={styles.gripSpace} />
    <span className={styles.time} data-testid={planEditorTestIds.time}>
      {span}
    </span>
    {status && <StatusIcon status={status} />}
    <span className={styles.title}>
      <span className={styles.titleText} data-testid={planEditorTestIds.title}>
        <TaskLink task={task} />
      </span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </span>
    <span className={styles.estimate}>{minutesText(minutes)}</span>
  </li>
)

const PlanRowItem = ({ row, busy, dropAfter, onRemove, onEstimated }: PlanRowItemProps) => {
  const { task, span, status, detail } = row
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging, isOver, active } =
    useSortable({ id: task.id, disabled: busy })
  const suggestionOver = isOver && String(active?.id).startsWith(SUGGESTION)
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={[
        styles.row,
        styles.draggable,
        isDragging ? styles.dragging : "",
        suggestionOver ? (dropAfter ? styles.dropAfter : styles.dropBefore) : ""
      ].join(" ")}
      data-testid={planEditorTestIds.row}
      {...pointerOnly(listeners)}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={`${styles.iconButton} ${styles.grip}`}
        {...attributes}
        onKeyDown={keyHandler(listeners)}
        aria-label={`Move ${task.title}`}
        data-testid={planEditorTestIds.grip}
      >
        <GripVertical size={14} aria-hidden />
      </button>
      <span className={styles.time} data-testid={planEditorTestIds.time}>
        {span}
      </span>
      {status && <StatusIcon status={status} />}
      <span className={styles.title}>
        <span className={styles.titleText} data-testid={planEditorTestIds.title}>
          <TaskLink task={task} />
        </span>
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
      <>
        <TaskEstimate task={task} testId={planEditorTestIds.minutes} onEstimated={onEstimated} />
        {/* The task under way can move, but not come out: finish or stop it first. */}
        {row.underWay ? (
          <span className={styles.gripSpace} />
        ) : (
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onRemove(task.id)}
            disabled={busy}
            aria-label={`Take ${task.title} out`}
            data-testid={planEditorTestIds.remove}
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </>
    </li>
  )
}

/** The plan: a suggestion dropped on it, but not on a row, goes last. */
const PlanColumn = ({ accepting, children }: { accepting: boolean; children: ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: PLAN_END, disabled: !accepting })
  return (
    <section
      ref={setNodeRef}
      className={`${styles.column} ${accepting && isOver ? styles.dropAtEnd : ""}`}
      aria-labelledby="plan-heading"
    >
      {children}
    </section>
  )
}

/** The suggestions, which take a planned task dragged back to them out of the plan. */
const SuggestionsColumn = ({ accepting, children }: { accepting: boolean; children: ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: SUGGESTIONS, disabled: !accepting })
  return (
    <section
      ref={setNodeRef}
      className={`${styles.column} ${accepting ? styles.takesBack : ""} ${accepting && isOver ? styles.takingBack : ""}`}
      aria-labelledby="suggestions-heading"
    >
      {children}
    </section>
  )
}

/** Tasks to choose from beside the plan: in order, each with its time and when that falls. */
export const PlanEditor = ({
  rows,
  suggestions,
  search,
  onSearch,
  onAdd,
  onRemove,
  onMove,
  onEstimated,
  busy = false
}: PlanEditorProps) => {
  const [dragged, setDragged] = useState<UniqueIdentifier | undefined>(undefined)
  const [byKeyboard, setByKeyboard] = useState(false)
  /** What the dragged task is over now, if anything: let go over nothing, and it glides back. */
  const [target, setTarget] = useState<UniqueIdentifier | undefined>(undefined)
  const [dropAfter, setDropAfter] = useState(false)
  const draggingSuggestion = String(dragged).startsWith(SUGGESTION)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const movable = rows.filter(({ locked }) => !locked).map(({ task }) => task.id)
  const titleOf = (id: UniqueIdentifier | undefined): string => {
    const taskId = String(id).replace(SUGGESTION, "")
    if (id === PLAN_END) return "the end of the plan"
    if (id === SUGGESTIONS) return "the suggestions, to take it out"
    return (
      rows.find(({ task }) => task.id === taskId)?.task.title ??
      suggestions.find((task) => task.id === taskId)?.title ??
      ""
    )
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} is over ${titleOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} dropped at ${titleOf(over.id)}.` : `${titleOf(active.id)} put back.`,
    onDragCancel: ({ active }) => `${titleOf(active.id)} put back.`
  }

  /** The drop target stays as it was until the next drag: the overlay reads it as it lets go, to glide back or not. */
  const finished = () => setDragged(undefined)

  /** A suggestion let go on the plan: on a row, before or after it by which half; elsewhere on the plan, last. */
  const droppedSuggestion = (event: DragEndEvent, over: Over) => {
    const task = (event.active.data.current as { task?: Task } | undefined)?.task
    if (!task) return
    const place = movable.indexOf(over.id as TaskId)
    onAdd(task, over.id === PLAN_END || place < 0 ? undefined : place + (inLowerHalf(event) ? 1 : 0))
  }

  /** A planned task let go: on the suggestions, out of the plan; on another row, into its place. */
  const droppedPlanned = (taskId: TaskId, over: Over) => {
    if (over.id === SUGGESTIONS) onRemove(taskId)
    const place = movable.indexOf(over.id as TaskId)
    if (over.id !== taskId && place >= 0) onMove(taskId, place)
  }

  const dropped = (event: DragEndEvent) => {
    finished()
    const { active, over } = event
    if (!over) return
    if (String(active.id).startsWith(SUGGESTION)) droppedSuggestion(event, over)
    else droppedPlanned(active.id as TaskId, over)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={underPointer}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move a task, press space or enter to pick it up, the arrow keys to move it, and space or enter again to put it down, or escape to put it back."
        }
      }}
      onDragStart={({ active, activatorEvent }) => {
        setDragged(active.id)
        setTarget(undefined)
        setByKeyboard(activatorEvent instanceof KeyboardEvent)
      }}
      onDragOver={({ over }) => setTarget(over?.id)}
      onDragMove={(event) => setDropAfter(inLowerHalf(event))}
      onDragCancel={() => {
        setTarget(undefined)
        finished()
      }}
      onDragEnd={dropped}
    >
      <div className={styles.columns}>
        <SuggestionsColumn accepting={dragged !== undefined && !String(dragged).startsWith(SUGGESTION) && !byKeyboard}>
          <div className={styles.columnHeader}>
            <h2 id="suggestions-heading" className={styles.columnTitle}>
              Suggestions
            </h2>
            <input
              className={styles.search}
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Find any task…"
              aria-label="Find a task"
              data-testid={planEditorTestIds.search}
            />
          </div>
          {suggestions.length === 0 ? (
            <p className={styles.empty} data-testid={planEditorTestIds.noSuggestions}>
              {search ? "No task matches." : "Every task you have is in the plan."}
            </p>
          ) : (
            <ul className={styles.list}>
              {suggestions.map((task) => (
                <SuggestionRow key={task.id} task={task} busy={busy} onAdd={onAdd} />
              ))}
            </ul>
          )}
        </SuggestionsColumn>

        <PlanColumn accepting={draggingSuggestion}>
          <div className={styles.columnHeader}>
            <h2 id="plan-heading" className={styles.columnTitle}>
              Your plan
            </h2>
          </div>
          <SortableContext items={movable} strategy={makeRoom}>
            {rows.length > 0 && (
              <ol className={styles.list}>
                {rows.map((row) =>
                  row.locked ? (
                    <LockedRow key={row.task.id} row={row} />
                  ) : (
                    <PlanRowItem
                      key={row.task.id}
                      row={row}
                      busy={busy}
                      dropAfter={dropAfter}
                      onRemove={onRemove}
                      onEstimated={onEstimated}
                    />
                  )
                )}
              </ol>
            )}
          </SortableContext>
          {rows.length === 0 && (
            <p className={styles.empty} data-testid={planEditorTestIds.empty}>
              Drag tasks here, or add them from the suggestions, in the order you'll do them.
            </p>
          )}
        </PlanColumn>
      </div>
      {/* Dropped somewhere, the task is in its new place at once; let go over nothing, and it glides back to where it was. */}
      {/* oxlint-disable-next-line eslint-js/no-restricted-syntax -- the library's "no animation" */}
      <DragOverlay dropAnimation={target === undefined ? undefined : null}>
        {dragged === undefined ? undefined : <div className={styles.overlay}>{titleOf(dragged)}</div>}
      </DragOverlay>
    </DndContext>
  )
}
