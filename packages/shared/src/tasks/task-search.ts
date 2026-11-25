import { ACTIVE_STATUSES, type Task } from "./task.ts"

/** The words searched for, in lower case. */
const wordsOf = (search: string): string[] =>
  search
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "")

/** What a search looks in: a task's title, notes, tags and checklist, and what its comments say where they're known. */
export type Searched = Pick<Task, "title" | "notes"> & {
  tags?: readonly string[]
  checklist?: readonly { text: string }[]
  comments?: readonly string[]
}

/**
 * Whether a task is found by what's typed: every word in its title, its
 * notes, its tags or its comments, in any order, in any case, each word's
 * in any of them. Nothing typed finds everything.
 */
export const matchesSearch = (task: Searched, search: string): boolean => {
  const text = [
    task.title,
    task.notes,
    ...(task.tags ?? []),
    ...(task.checklist ?? []).map((item) => item.text),
    ...(task.comments ?? [])
  ]
    .join("\n")
    .toLowerCase()
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
 * only elsewhere. Otherwise in the order given. `commentsOf` gives what each
 * task's comments say, to search those too.
 */
export const searchResults = <T extends Pick<Task, "title" | "notes" | "status">>(
  tasks: readonly T[],
  search: string,
  commentsOf: (task: T) => readonly string[] = () => []
): T[] => {
  const rank = (task: T): number => (ACTIVE_STATUSES.includes(task.status) ? 0 : 2) + (inTitle(task, search) ? 0 : 1)
  return tasks
    .filter((task) => matchesSearch({ ...task, comments: commentsOf(task) }, search))
    .map((task, index) => ({ task, index }))
    .sort((a, b) => rank(a.task) - rank(b.task) || a.index - b.index)
    .map(({ task }) => task)
}
