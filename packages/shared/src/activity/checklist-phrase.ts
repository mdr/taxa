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
  const parts = [
    ...(added.length ? [`added ${named(added)} to the checklist`] : []),
    ...(ticked.length ? [`ticked ${named(ticked)}`] : []),
    ...(unticked.length ? [`unticked ${named(unticked)}`] : []),
    ...reworded.map((item) => `changed ${quoted(was.get(item.id)!.text)} to ${quoted(item.text)}`),
    ...madeTasks.map((item) => `made ${quoted(item.text)} a task of its own`),
    ...(removed.length ? [`removed ${named(removed)} from the checklist`] : [])
  ]
  return parts.join(" and ") || "changed the checklist"
}
