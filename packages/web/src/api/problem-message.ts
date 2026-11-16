import { TaxaApiError } from "@taxa/shared/api/taxa-client"

/** What went wrong, for people: the server's explanation, or that it couldn't be reached. */
export const problemMessage = (error: unknown): string =>
  error instanceof TaxaApiError ? error.problem.message : "Can't reach the server. Check your connection and try again."
