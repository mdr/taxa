import { ProblemType } from "@taxa/shared/api/problem"
import { checklistItemId, uuidv7, type ChecklistItemId } from "@taxa/shared/ids"
import {
  ChecklistChangeType,
  MAX_CHECKLIST_ITEMS,
  type ChecklistRequestSchema,
  type StoredChecklistItem
} from "@taxa/shared/tasks/checklist"
import type { Instant } from "@taxa/shared/units"
import type { z } from "zod"
import { ProblemError } from "../http/problem-error.ts"

type Checklist = readonly StoredChecklistItem[]

/** New items, none ticked. */
export const newItems = (texts: readonly string[], now: Instant): StoredChecklistItem[] =>
  texts.map((text) => ({ id: checklistItemId(uuidv7(now)), text, done: false }))

/** The item asked for, refused if it's not on the checklist. */
export const itemIn = (checklist: Checklist, id: ChecklistItemId, ref: string): StoredChecklistItem => {
  const item = checklist.find((each) => each.id === id)
  if (!item)
    throw new ProblemError(ProblemType.NOT_FOUND, `That item isn't on ${ref}'s checklist: it may have been removed.`)
  return item
}

const added = (
  checklist: Checklist,
  texts: readonly string[],
  after: ChecklistItemId | undefined,
  now: Instant,
  ref: string
): Checklist => {
  if (checklist.length + texts.length > MAX_CHECKLIST_ITEMS)
    throw new ProblemError(
      ProblemType.INVALID_REQUEST,
      `A checklist holds at most ${MAX_CHECKLIST_ITEMS} items: ${ref} has ${checklist.length}. Make some of them tasks of their own instead.`
    )
  const at = after === undefined ? checklist.length : checklist.indexOf(itemIn(checklist, after, ref)) + 1
  return [...checklist.slice(0, at), ...newItems(texts, now), ...checklist.slice(at)]
}

const withItem = (
  checklist: Checklist,
  id: ChecklistItemId,
  ref: string,
  change: (item: StoredChecklistItem) => StoredChecklistItem
): Checklist => {
  const item = itemIn(checklist, id, ref)
  return checklist.map((each) => (each === item ? change(each) : each))
}

/** A checklist with an item moved after another, or to the top. */
const moved = (
  checklist: Checklist,
  id: ChecklistItemId,
  after: ChecklistItemId | undefined,
  ref: string
): Checklist => {
  const item = itemIn(checklist, id, ref)
  if (after === id) return checklist
  const rest = checklist.filter((each) => each !== item)
  const at = after === undefined ? 0 : rest.indexOf(itemIn(rest, after, ref)) + 1
  return [...rest.slice(0, at), item, ...rest.slice(at)]
}

/** A checklist with an item added, ticked, reworded, removed or moved, as asked; making a task is the service's. */
export const changedChecklist = (
  checklist: Checklist,
  request: Exclude<z.infer<typeof ChecklistRequestSchema>, { type: ChecklistChangeType.MAKE_TASK }>,
  ref: string,
  now: Instant
): Checklist => {
  switch (request.type) {
    case ChecklistChangeType.ADD:
      return added(checklist, request.texts, request.after, now, ref)
    case ChecklistChangeType.TICK:
      return withItem(checklist, request.item, ref, (item) => {
        if (item.taskId)
          throw new ProblemError(
            ProblemType.INVALID_REQUEST,
            `“${item.text}” is a task of its own now: it's ticked when that task is done.`
          )
        return { ...item, done: request.done }
      })
    case ChecklistChangeType.RENAME:
      return withItem(checklist, request.item, ref, (item) => ({ ...item, text: request.text }))
    case ChecklistChangeType.REMOVE:
      itemIn(checklist, request.item, ref)
      return checklist.filter(({ id }) => id !== request.item)
    case ChecklistChangeType.MOVE:
      return moved(checklist, request.item, request.after, ref)
  }
}
