import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import { appLogger } from "../telemetry/app-telemetry.ts"
import { LOG_CODES } from "../telemetry/codes.ts"
import { isSignedOut } from "../sign-in/sign-in.ts"

const requestFailed = (error: Error): void =>
  appLogger.warn(LOG_CODES.api.requestFailed, "a request to the API failed", {
    problem: error instanceof TaxaApiError ? error.problem.type : error instanceof Error ? error.name : typeof error
  })

const kept = import.meta.hot?.data as { queryClient?: QueryClient } | undefined

/**
 * What the page knows from the server, which every screen shows. In
 * development it's kept across hot updates: the app's services hold on to
 * it, so a new one would leave the screen showing what they no longer update.
 */
export const queryClient: QueryClient =
  kept?.queryClient ??
  new QueryClient({
    // Once more if it failed, unless for not being signed in: that's for the sign-in page, at once.
    defaultOptions: { queries: { retry: (failures, error) => failures < 1 && !isSignedOut(error) } },
    queryCache: new QueryCache({ onError: requestFailed }),
    mutationCache: new MutationCache({ onError: requestFailed })
  })

if (kept) kept.queryClient = queryClient
