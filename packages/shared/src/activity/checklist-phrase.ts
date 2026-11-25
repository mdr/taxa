import { z } from "zod"
import { StoredChecklistItemSchema, type StoredChecklistItem } from "../tasks/checklist.ts"
import type { FieldChange } from "./activity.ts"

const itemsOf = (value: unknown): StoredChecklistItem[] => {
  const parsed = z.array(StoredChecklistItemSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}

const quoted = (text: string): string => `“${text.length > 60 ? `${text.slice(0, 59)}…` : text}”`

/** `“Oxfam”`, or `3 items`. */
const named = (items: readonly StoredChecklistItem[]): string =>
  items.length === 1 ? quoted(items[0]!.text) : `${items.length} items`

const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index])

/** The items moved, if any: one that, left out, leaves the rest in the order they were; or, failing that, all of them. */
const movedItems = (
  before: readonly StoredChecklistItem[],
  kept: readonly StoredChecklistItem[]
): StoredChecklistItem[] => {
  const ids = (items: readonly StoredChecklistItem[], without?: string): string[] =>
    items.map(({ id }) => id).filter((id) => id !== without && kept.some((item) => item.id === id))
  if (sameOrder(ids(before), ids(kept))) return []
  const one = kept.find(({ id }) => sameOrder(ids(before, id), ids(kept, id)))
  return one ? [one] : [...kept]
}

/** What a change to a checklist did, item by item: `ticked “Oxfam”`, `added 3 items to the checklist`. */
export const checklistPhrase = ({ from, to }: FieldChange): string => {
  const before = itemsOf(from)
  const after = itemsOf(to)
  const was = new Map(before.map((item) => [item.id, item]))
  const kept = after.filter(({ id }) => was.has(id))
  const changed = (test: (old: StoredChecklistItem, now: StoredChecklistItem) => boolean): StoredChecklistItem[] =>
    kept.filter((item) => test(was.get(item.id)!, item))
  const added = after.filter(({ id }) => !was.has(id))
  const removed = before.filter(({ id }) => !after.some((item) => item.id === id))
  const ticked = changed((old, now) => !old.done && now.done)
  const unticked = changed((old, now) => old.done && !now.done)
  const reworded = changed((old, now) => old.text !== now.text)
  const madeTasks = changed((old, now) => old.taskId === undefined && now.taskId !== undefined)
  const moved = movedItems(before, kept)
  const parts = [
    ...(added.length ? [`added ${named(added)} to the checklist`] : []),
    ...(ticked.length ? [`ticked ${named(ticked)}`] : []),
    ...(unticked.length ? [`unticked ${named(unticked)}`] : []),
    ...reworded.map((item) => `changed ${quoted(was.get(item.id)!.text)} to ${quoted(item.text)}`),
    ...madeTasks.map((item) => `made ${quoted(item.text)} a task of its own`),
    ...(removed.length ? [`removed ${named(removed)} from the checklist`] : []),
    ...(moved.length === 1 ? [`moved ${named(moved)}`] : moved.length ? ["reordered the checklist"] : [])
  ]
  return parts.join(" and ") || "changed the checklist"
}
