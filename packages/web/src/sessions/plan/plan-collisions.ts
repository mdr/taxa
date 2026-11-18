import {
  closestCenter,
  pointerWithin,
  type ClientRect,
  type CollisionDetection,
  type DragMoveEvent
} from "@dnd-kit/core"
import { getEventCoordinates, type Coordinates } from "@dnd-kit/utilities"
import { PLAN_END, SUGGESTIONS } from "./plan-drop.ts"

/**
 * With a mouse or finger, only what's under the pointer: a row before the
 * column it's in, and nothing at all elsewhere, so letting go there puts it
 * back. With the keyboard, which has no pointer, the nearest row.
 */
export const underPointer: CollisionDetection = (args) => {
  const { pointerCoordinates: pointer, droppableRects } = args
  if (!pointer) return closestCenter(args)
  const hits = pointerWithin(args)
  const rows = hits.filter(({ id }) => id !== PLAN_END && id !== SUGGESTIONS)
  if (rows.length > 0) return rows
  if (hits.length > 0) return hits
  return [PLAN_END, SUGGESTIONS].flatMap((id) => {
    const rect = droppableRects.get(id)
    return rect && onSideOf(id, rect, pointer) ? [{ id }] : []
  })
}

/** How far past a column's edge still counts as on its side: about the gutter between the two. */
const REACH = 24

/**
 * Whether a point outside a column is still on its side of the page, to be
 * generous with where a task can be let go: for the plan, anywhere to its
 * right or below it, from the gutter on; for the suggestions, in its gutter.
 */
const onSideOf = (id: string, rect: ClientRect, { x, y }: Coordinates): boolean =>
  id === PLAN_END
    ? x >= rect.left - REACH && y >= rect.top - REACH
    : x >= rect.left - REACH && x <= rect.right + REACH && y >= rect.top - REACH && y <= rect.bottom + REACH

/** How far down the page the pointer is: none, dragging by keyboard. */
export const pointerY = ({ activatorEvent, delta }: DragMoveEvent): number | undefined => {
  const start = getEventCoordinates(activatorEvent)
  return start ? start.y + delta.y : undefined
}

/**
 * How far down the page the middle of each planned task that can move is,
 * as if no gap were open: those after the gap are reckoned that much higher.
 */
export const middlesIn = (list: HTMLElement | undefined): number[] => {
  let shift = 0
  const middles: number[] = []
  for (const item of list?.children ?? []) {
    const { top, height } = item.getBoundingClientRect()
    if (item instanceof HTMLElement && item.dataset["gap"] !== undefined) {
      const { marginTop, marginBottom } = getComputedStyle(item)
      shift = height + Number.parseFloat(marginTop) + Number.parseFloat(marginBottom)
    } else if (item instanceof HTMLElement && item.dataset["movable"] !== undefined)
      middles.push(top - shift + height / 2)
  }
  return middles
}
