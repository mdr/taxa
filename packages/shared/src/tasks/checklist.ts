import { z } from "zod"
import { ChecklistItemIdSchema, TaskIdSchema } from "../ids.ts"
import { TaskRefSchema } from "./task-ref.ts"

/** The most items a checklist holds. */
export const MAX_CHECKLIST_ITEMS = 200

export const ChecklistTextSchema = z.string().trim().min(1).max(500)

/** An item as a task keeps it, and as its activity logs it. */
export const StoredChecklistItemSchema = z.object({
  id: ChecklistItemIdSchema,
  text: z.string(),
  done: z.boolean(),
  /** Made a task of its own: that task, which ticks it when it's done. */
  taskId: TaskIdSchema.optional()
})

export type StoredChecklistItem = z.infer<typeof StoredChecklistItemSchema>

/** One of a task's steps, ticked off as it's done. */
export const ChecklistItemSchema = z.object({
  id: ChecklistItemIdSchema,
  text: z.string(),
  /** Ticked; for an item made a task, whether that task is done. */
  done: z.boolean(),
  /** Made a task of its own, which ticks it when it's done. */
  task: z.object({ id: TaskIdSchema, ref: TaskRefSchema }).optional()
})

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>

export interface ChecklistProgress {
  done: number
  total: number
}

export const checklistProgress = (items: readonly { done: boolean }[]): ChecklistProgress => ({
  done: items.filter(({ done }) => done).length,
  total: items.length
})

/** `3/8`. */
export const progressText = ({ done, total }: ChecklistProgress): string => `${done}/${total}`

/** Each line of pasted text as an item, leaving out blank lines and list markers: `- `, `* `, `1. `, `[ ] `. */
export const itemsFromText = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*+]|\d+[.)])?\s*(?:\[[ xX]?\]\s*)?/, "").trim())
    .filter((line) => line !== "")
    .map((line) => line.slice(0, 500))

export enum ChecklistChangeType {
  ADD = "ADD",
  TICK = "TICK",
  RENAME = "RENAME",
  REMOVE = "REMOVE",
  /** Moves an item to another place on the checklist. */
  MOVE = "MOVE",
  /** Makes an item a task of its own, following on from this one; the item stays, ticked when that task is done. */
  MAKE_TASK = "MAKE_TASK"
}

export const ChecklistRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(ChecklistChangeType.ADD),
    texts: z.array(ChecklistTextSchema).min(1).max(MAX_CHECKLIST_ITEMS),
    /** After this item; at the end otherwise. */
    after: ChecklistItemIdSchema.optional()
  }),
  z.object({ type: z.literal(ChecklistChangeType.TICK), item: ChecklistItemIdSchema, done: z.boolean() }),
  z.object({ type: z.literal(ChecklistChangeType.RENAME), item: ChecklistItemIdSchema, text: ChecklistTextSchema }),
  z.object({ type: z.literal(ChecklistChangeType.REMOVE), item: ChecklistItemIdSchema }),
  z.object({
    type: z.literal(ChecklistChangeType.MOVE),
    item: ChecklistItemIdSchema,
    /** After this item; first otherwise. */
    after: ChecklistItemIdSchema.optional()
  }),
  z.object({
    type: z.literal(ChecklistChangeType.MAKE_TASK),
    item: ChecklistItemIdSchema,
    /** The new task's id, chosen by the client (a UUIDv7). */
    taskId: TaskIdSchema.optional()
  })
])

export type ChecklistRequest = z.input<typeof ChecklistRequestSchema>
