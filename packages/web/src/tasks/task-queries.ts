import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from "@tanstack/react-query"
import type { Activity } from "@taxa/shared/activity/activity"
import type { Comment } from "@taxa/shared/comments/comment"
import type { Me } from "@taxa/shared/identity/actor"
import type { CreateTaskRequest, ListTasksQuery } from "@taxa/shared/tasks/task-requests"
import type { Task } from "@taxa/shared/tasks/task"
import { queryKeys } from "../api/query-keys.ts"
import { taxaApi } from "../api/taxa-api.ts"
import { useUndo } from "../undo/undo-service.ts"

/** The tasks a query finds; not asked for while `enabled` is false. */
export const useTasks = (query: ListTasksQuery, enabled = true): UseQueryResult<Task[]> =>
  useQuery({ queryKey: queryKeys.tasks(query), queryFn: () => taxaApi.tasks(query), enabled })

/** A task, by ref or id; not asked for while `enabled` is false. */
export const useTask = (ref: string, enabled = true): UseQueryResult<Task> =>
  useQuery({ queryKey: queryKeys.task(ref), queryFn: () => taxaApi.task(ref), enabled })

export const useActivity = (ref: string): UseQueryResult<Activity[]> =>
  useQuery({ queryKey: queryKeys.activity(ref), queryFn: () => taxaApi.activity(ref) })

/** A task's comments, oldest first. */
export const useComments = (taskId: string): UseQueryResult<Comment[]> =>
  useQuery({ queryKey: queryKeys.comments(taskId), queryFn: () => taxaApi.comments(taskId) })

/** Who the page is signed in as. */
export const useMe = (): UseQueryResult<Me> => useQuery({ queryKey: queryKeys.me, queryFn: () => taxaApi.me() })

export const useCreateTask = (): UseMutationResult<Task, Error, CreateTaskRequest> => {
  const queryClient = useQueryClient()
  const { add } = useUndo()
  return useMutation({
    // A fresh key per capture, so a retried request can't add it twice.
    mutationFn: (request) => add(() => taxaApi.createTask(request, crypto.randomUUID())),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.allTasks }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      ])
  })
}
