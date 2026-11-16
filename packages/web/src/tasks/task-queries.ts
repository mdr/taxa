import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from "@tanstack/react-query"
import type { Activity } from "@taxa/shared/activity/activity"
import type { CreateTaskRequest, ListTasksQuery } from "@taxa/shared/tasks/task-requests"
import type { Task } from "@taxa/shared/tasks/task"
import { queryKeys } from "../api/query-keys.ts"
import { taxaApi } from "../api/taxa-api.ts"

export const useTasks = (query: ListTasksQuery): UseQueryResult<Task[]> =>
  useQuery({ queryKey: queryKeys.tasks(query), queryFn: () => taxaApi.tasks(query) })

export const useTask = (ref: string): UseQueryResult<Task> =>
  useQuery({ queryKey: queryKeys.task(ref), queryFn: () => taxaApi.task(ref) })

export const useActivity = (ref: string): UseQueryResult<Activity[]> =>
  useQuery({ queryKey: queryKeys.activity(ref), queryFn: () => taxaApi.activity(ref) })

export const useCreateTask = (): UseMutationResult<Task, Error, CreateTaskRequest> => {
  const queryClient = useQueryClient()
  return useMutation({
    // A fresh key per capture, so a retried request can't add it twice.
    mutationFn: (request) => taxaApi.createTask(request, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allTasks })
  })
}
