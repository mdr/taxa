import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ProblemType } from "@taxa/shared/api/problem"
import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import type { ChangeStatusRequest, UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import { TaskSchema, type Task } from "@taxa/shared/tasks/task"
import { useState } from "react"
import { problemMessage } from "../api/problem-message.ts"
import { queryKeys } from "../api/query-keys.ts"
import { taxaApi } from "../api/taxa-api.ts"

export const CONFLICT_NOTICE =
  "Someone else changed this task just now, so your change wasn't saved. This is the task as it is now: make your change again if you still want it."

export enum TaskChangeType {
  UPDATE = "UPDATE",
  STATUS = "STATUS",
  DELETE = "DELETE",
  RESTORE = "RESTORE"
}

export type TaskChange =
  | { type: TaskChangeType.UPDATE; request: UpdateTaskRequest }
  | { type: TaskChangeType.STATUS; request: ChangeStatusRequest }
  | { type: TaskChangeType.DELETE }
  | { type: TaskChangeType.RESTORE }

const send = (task: Task, change: TaskChange): Promise<Task> => {
  // Each change is based on the latest version this page has seen, so it can't silently overwrite one it hasn't.
  switch (change.type) {
    case TaskChangeType.UPDATE:
      return taxaApi.updateTask(task.id, change.request, task.version)
    case TaskChangeType.STATUS:
      return taxaApi.changeStatus(task.id, change.request, task.version)
    case TaskChangeType.DELETE:
      return taxaApi.deleteTask(task.id, task.version)
    case TaskChangeType.RESTORE:
      return taxaApi.restoreTask(task.id)
  }
}

export interface TaskChanges {
  change: (change: TaskChange) => void
  /** Why the last change didn't happen, if it didn't. */
  problem: string | undefined
}

/** Changes to the task shown under `queryRef`, refreshing everything that shows it. */
export const useTaskChanges = (task: Task | undefined, queryRef: string): TaskChanges => {
  const queryClient = useQueryClient()
  const [problem, setProblem] = useState<string>()
  const show = async (latest: Task): Promise<void> => {
    queryClient.setQueryData(queryKeys.task(queryRef), latest)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.allTasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.allActivity })
    ])
  }
  const mutation = useMutation({
    // One change to a task at a time, each based on the version the one before it left.
    scope: { id: `task-${task?.id}` },
    mutationFn: (change: TaskChange) => {
      const latest = queryClient.getQueryData<Task>(queryKeys.task(queryRef)) ?? task
      if (!latest) throw new Error("no task to change")
      return send(latest, change)
    },
    onMutate: () => setProblem(undefined),
    onSuccess: show,
    onError: async (error) => {
      if (error instanceof TaxaApiError && error.problem.type === ProblemType.VERSION_CONFLICT) {
        setProblem(CONFLICT_NOTICE)
        const current = TaskSchema.safeParse(error.problem.current)
        if (current.success) await show(current.data)
        return
      }
      setProblem(problemMessage(error))
    }
  })
  return { change: (change) => mutation.mutate(change), problem }
}
