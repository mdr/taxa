import type { TaskId } from "@taxa/shared/ids"

/** Where a drag can end: on a planned task (its id), on the plan but no task in it, or on the suggestions. */
export const PLAN_END = "plan-end"
export const SUGGESTIONS = "suggestions"

/** A suggestion's drag id is marked as one; a planned task's is its id. */
const SUGGESTION = "suggestion:"

export const suggestionDragId = (taskId: TaskId): string => `${SUGGESTION}${taskId}`

export const isSuggestion = (dragId: string): boolean => dragId.startsWith(SUGGESTION)

/** The task a drag id stands for. */
export const draggedTask = (dragId: string): TaskId => dragId.replace(SUGGESTION, "") as TaskId

export enum DropType {
  /** A suggestion into the plan: at a place among the tasks that can move, or last. */
  ADD = "ADD",
  /** A planned task to another's place. */
  MOVE = "MOVE",
  /** A planned task back out of the plan. */
  REMOVE = "REMOVE"
}

export type Drop =
  | { type: DropType.ADD; taskId: TaskId; at: number | undefined }
  | { type: DropType.MOVE; taskId: TaskId; to: number }
  | { type: DropType.REMOVE; taskId: TaskId }

export interface DragEnd {
  dragged: string
  /** What it was let go on: nothing, if it was let go elsewhere. */
  over: string | undefined
  /** Whether it was let go on the lower half of a task, to go after it rather than before. */
  lowerHalf: boolean
  /** The planned tasks that can move, in order. */
  movable: readonly TaskId[]
}

/**
 * What letting go does, if anything. A suggestion on a task goes before or
 * after it, by which half; anywhere else on the plan, last. A planned task
 * on another takes its place; on the suggestions, it comes out. Let go
 * anywhere else, nothing changes.
 */
export const dropOf = ({ dragged, over, lowerHalf, movable }: DragEnd): Drop | undefined => {
  if (over === undefined) return undefined
  const taskId = draggedTask(dragged)
  const place = movable.indexOf(over as TaskId)
  if (isSuggestion(dragged)) {
    if (over === SUGGESTIONS) return undefined
    return { type: DropType.ADD, taskId, at: place < 0 ? undefined : place + (lowerHalf ? 1 : 0) }
  }
  if (over === SUGGESTIONS) return { type: DropType.REMOVE, taskId }
  return over !== taskId && place >= 0 ? { type: DropType.MOVE, taskId, to: place } : undefined
}
