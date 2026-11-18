import { useQuery, useQueryClient, type QueryClient, type UseQueryResult } from "@tanstack/react-query"
import { sessionId } from "@taxa/shared/ids"
import type { CurrentSession, Session } from "@taxa/shared/sessions/session"
import { useMemo } from "react"
import { queryKeys } from "../api/query-keys.ts"
import { taxaApi } from "../api/taxa-api.ts"
import type { SessionRunListener } from "./run/session-run-service.ts"

/** Your session under way, if any: wrapped, as the query cache can't hold undefined. */
export const useCurrentSession = (): UseQueryResult<CurrentSession> =>
  useQuery({ queryKey: queryKeys.currentSession, queryFn: async () => ({ session: await taxaApi.currentSession() }) })

export const useSession = (id: string): UseQueryResult<Session> =>
  useQuery({ queryKey: queryKeys.session(id), queryFn: () => taxaApi.session(sessionId(id)) })

/** Keeps the cache up with a session the server has changed, and the tasks it moved on. */
export const sessionChanged = (queryClient: QueryClient, session: Session): void => {
  queryClient.setQueryData(queryKeys.session(session.id), session)
  queryClient.setQueryData<CurrentSession>(queryKeys.currentSession, { session: session.endedAt ? undefined : session })
  void queryClient.invalidateQueries({ queryKey: queryKeys.allTasks })
  void queryClient.invalidateQueries({ queryKey: queryKeys.allTask })
  void queryClient.invalidateQueries({ queryKey: queryKeys.allActivity })
}

export const useSessionListener = (): SessionRunListener => {
  const queryClient = useQueryClient()
  return useMemo(
    () => ({
      changed: (session) => sessionChanged(queryClient, session),
      stale: () => void queryClient.invalidateQueries({ queryKey: ["session"] })
    }),
    [queryClient]
  )
}
