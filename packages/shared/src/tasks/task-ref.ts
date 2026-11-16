import { z } from "zod"

/** How a task is named to people: its domain's prefix and its number, `H-142`. */
export const formatTaskRef = (prefix: string, number: number): string => `${prefix}-${number}`

export type TaskRef = { type: "ID"; id: string } | { type: "NUMBER"; number: number }

const NUMBERED = /^(?:([A-Za-z]{1,5})-)?(\d+)$/

/**
 * A task named as `H-142`, `h-142`, `142` or its UUID. The prefix doesn't
 * matter: the number alone is unique, so a task that moved domain keeps its
 * old names too.
 */
export const parseTaskRef = (text: string): TaskRef | undefined => {
  const trimmed = text.trim()
  if (z.uuid().safeParse(trimmed).success) return { type: "ID", id: trimmed.toLowerCase() }
  const numbered = NUMBERED.exec(trimmed)
  if (!numbered) return undefined
  const number = Number(numbered[2])
  return Number.isSafeInteger(number) && number > 0 ? { type: "NUMBER", number } : undefined
}
