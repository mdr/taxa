import type { TaskId } from "@taxa/shared/ids"

/**
 * Where a drag can end: on a planned task (its id), on the gap opened in the
 * plan for a suggestion, on the plan's side but no task in it, or on the
 * suggestions.
 */
export const PLAN_END = "plan-end"
export const PLAN_GAP = "plan-gap"
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

export interface GapAt {
  /** What a suggestion is over: nothing, if it's over nowhere it can go. */
  over: string | undefined
  /** How far down the page the pointer is: none, dragging by keyboard. */
  y: number | undefined
  /** How far down the page the middle of each task that can move is, as if no gap were open. */
  middles: readonly number[]
  /** The planned tasks that can move, in order. */
  movable: readonly TaskId[]
  /** Where the gap is open now, if it is. */
  open: number | undefined
}

/**
 * Where the plan opens a gap for a suggestion dragged over its side, as a
 * place among the tasks that can move (their count, for last); none, off
 * it. With a pointer, after every task whose middle it's below, reckoned as
 * if no gap were open: the gap moving never moves the place. With the
 * keyboard, before the task it's over; over the gap, where it is; else last.
 */
export const gapAt = ({ over, y, middles, movable, open }: GapAt): number | undefined => {
  if (over === undefined || over === SUGGESTIONS) return undefined
  if (y !== undefined) return middles.filter((middle) => middle < y).length
  if (over === PLAN_GAP) return open
  const place = movable.indexOf(over as TaskId)
  return place < 0 ? movable.length : place
}

export interface DragEnd {
  dragged: string
  /** What it was let go on: nothing, if it was let go elsewhere. */
  over: string | undefined
  /** Where the plan had a gap open for a suggestion, if it did. */
  gap: number | undefined
  /** The planned tasks that can move, in order. */
  movable: readonly TaskId[]
}

/**
 * What letting go does, if anything. A suggestion goes where the plan
 * opened a gap for it. A planned task on another takes its place; on the
 * suggestions, it comes out. Let go anywhere else, nothing changes.
 */
export const dropOf = ({ dragged, over, gap, movable }: DragEnd): Drop | undefined => {
  const taskId = draggedTask(dragged)
  if (isSuggestion(dragged))
    return gap === undefined ? undefined : { type: DropType.ADD, taskId, at: gap < movable.length ? gap : undefined }
  if (over === SUGGESTIONS) return { type: DropType.REMOVE, taskId }
  const place = movable.indexOf(over as TaskId)
  return over !== taskId && place >= 0 ? { type: DropType.MOVE, taskId, to: place } : undefined
}
