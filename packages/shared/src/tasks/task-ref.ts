import { z } from "zod"
import { INBOX_PREFIX, type DomainPrefix } from "../domains/domain.ts"
import { TaskIdSchema, type TaskId } from "../ids.ts"
import type { TaskNumber } from "../units.ts"

/** How a task is named to people: its domain's prefix and its number, `H-142`, or `IN-142` in the Inbox. */
export const TaskRefSchema = z
  .string()
  .regex(/^[A-Z]{1,5}-[1-9]\d*$/)
  .brand<"TaskRef">()
export type TaskRef = z.infer<typeof TaskRefSchema>
const taskRef = (text: string): TaskRef => TaskRefSchema.parse(text)

/** A task's ref, from its domain's prefix, or none for the Inbox. */
export const formatTaskRef = (prefix: DomainPrefix | undefined, number: TaskNumber): TaskRef =>
  taskRef(`${prefix ?? INBOX_PREFIX}-${number}`)

/** How to find a task someone named. */
export type TaskLookup = { type: "ID"; id: TaskId } | { type: "NUMBER"; number: TaskNumber }

const NUMBERED = /^(?:([A-Za-z]{1,5})-)?(\d+)$/

/**
 * A task named as `H-142`, `h-142`, `142` or its UUID. The prefix doesn't
 * matter: the number alone is unique, so a task that moved domain keeps its
 * old names too.
 */
export const parseTaskLookup = (text: string): TaskLookup | undefined => {
  const trimmed = text.trim()
  const id = TaskIdSchema.safeParse(trimmed.toLowerCase())
  if (id.success) return { type: "ID", id: id.data }
  const numbered = NUMBERED.exec(trimmed)
  if (!numbered) return undefined
  const number = Number(numbered[2])
  return Number.isSafeInteger(number) && number > 0 ? { type: "NUMBER", number } : undefined
}
