import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from "@tanstack/react-query"
import type { CreateDomainRequest, Domain } from "@taxa/shared/domains/domain"
import { queryKeys } from "../api/query-keys.ts"
import { taxaApi } from "../api/taxa-api.ts"

export const useDomains = (): UseQueryResult<Domain[]> =>
  useQuery({ queryKey: queryKeys.domains, queryFn: () => taxaApi.domains() })

export const useCreateDomain = (): UseMutationResult<Domain, Error, CreateDomainRequest> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request) => taxaApi.createDomain(request, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.domains })
  })
}
