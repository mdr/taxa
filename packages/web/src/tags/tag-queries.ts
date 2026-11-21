import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from "@tanstack/react-query"
import type { RenameTagRequest, TagSummary } from "@taxa/shared/tasks/tags"
import { queryKeys } from "../api/query-keys.ts"
import { taxaApi } from "../api/taxa-api.ts"

/** The tags on tasks you can see, by name. */
export const useTags = (): UseQueryResult<TagSummary[]> =>
  useQuery({ queryKey: queryKeys.tags, queryFn: () => taxaApi.tags() })

export const useRenameTag = (): UseMutationResult<{ renamed: number }, Error, RenameTagRequest> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request) => taxaApi.renameTag(request),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tags }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allTasks }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allTask }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allActivity })
      ])
  })
}
