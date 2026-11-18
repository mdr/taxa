import { ACTIVE_STATUSES, type Task } from "./task.ts"

/** The words searched for, in lower case. */
const wordsOf = (search: string): string[] =>
  search
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "")

/**
 * Whether a task is found by what's typed: every word in its title or its
 * notes, in any order, in any case, each word's in either. Nothing typed
 * finds everything.
 */
export const matchesSearch = (task: Pick<Task, "title" | "notes">, search: string): boolean => {
  const text = `${task.title}\n${task.notes}`.toLowerCase()
  return wordsOf(search).every((word) => text.includes(word))
}

/** Whether every word is in the title alone. */
const inTitle = (task: Pick<Task, "title">, search: string): boolean => {
  const title = task.title.toLowerCase()
  return wordsOf(search).every((word) => title.includes(word))
}

/**
 * Tasks found by a search, best first: those still to do before those
 * finished, and among each, those found by their title before those found
 * only in their notes. Otherwise in the order given.
 */
export const searchResults = <T extends Pick<Task, "title" | "notes" | "status">>(
  tasks: readonly T[],
  search: string
): T[] => {
  const rank = (task: T): number => (ACTIVE_STATUSES.includes(task.status) ? 0 : 2) + (inTitle(task, search) ? 0 : 1)
  return tasks
    .filter((task) => matchesSearch(task, search))
    .map((task, index) => ({ task, index }))
    .sort((a, b) => rank(a.task) - rank(b.task) || a.index - b.index)
    .map(({ task }) => task)
}
