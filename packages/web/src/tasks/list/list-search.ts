import type { Task } from "@taxa/shared/tasks/task"
import { matchesSearch } from "@taxa/shared/tasks/task-search"

export interface ListSearchResult {
  /** The tasks still to do that show: those found, or all with nothing typed. */
  open: Task[] | undefined
  /** The finished tasks found. */
  completed: Task[]
  /** Whether the finished ones show: when asked for, or when a search finds some. */
  completedOpen: boolean
  /** What to say when a search finds nothing still to do; nothing, when there's no search or it finds some. */
  noMatches: string | undefined
}

/** What a list shows for what's typed to search it. */
export const listSearch = (
  open: readonly Task[] | undefined,
  completed: readonly Task[],
  search: string,
  completedAskedFor: boolean
): ListSearchResult => {
  const typed = search.trim()
  const openFound = open?.filter((task) => matchesSearch(task, typed))
  const completedFound = completed.filter((task) => matchesSearch(task, typed))
  const searching = typed !== ""
  return {
    open: openFound,
    completed: completedFound,
    completedOpen: completedAskedFor || (searching && completedFound.length > 0),
    noMatches:
      !searching || openFound?.length !== 0
        ? undefined
        : completedFound.length > 0
          ? "Nothing still to do matches"
          : `Nothing here matches “${typed}”`
  }
}
