import type { QueryClient } from "@tanstack/react-query"
import type { TaskId } from "@taxa/shared/ids"
import type { Task } from "@taxa/shared/tasks/task"
import { queryKeys } from "../../api/query-keys.ts"

/** What the page knows of tasks: the latest version it has seen, and how to show a newer one. */
export interface TaskCache {
  latest: (id: TaskId) => Task | undefined
  show: (task: Task) => Promise<void>
}

/** The cache over TanStack Query's: tasks shown on their own, and in lists. */
export const queryTaskCache = (queryClient: QueryClient): TaskCache => ({
  latest: (id) => {
    const single = queryClient.getQueriesData<Task>({ queryKey: queryKeys.allTask }).map(([, task]) => task)
    const listed = queryClient
      .getQueriesData<Task[]>({ queryKey: queryKeys.allTasks })
      .flatMap(([, tasks]) => tasks ?? [])
    return [...single, ...listed]
      .filter((task): task is Task => task?.id === id)
      .reduce<Task | undefined>((latest, task) => (latest && latest.version >= task.version ? latest : task), undefined)
  },
  show: async (task) => {
    queryClient.setQueriesData<Task>({ queryKey: queryKeys.allTask }, (shown) => (shown?.id === task.id ? task : shown))
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.allTasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.allActivity }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tags }),
      // A session shows its tasks: one deleted leaves it.
      queryClient.invalidateQueries({ queryKey: queryKeys.allSessions })
    ])
  }
})
