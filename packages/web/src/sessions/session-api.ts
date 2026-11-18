import type { TaxaClient } from "@taxa/shared/api/taxa-client"

/** What the session services ask of the API. */
export type SessionApi = Pick<TaxaClient, "createSession" | "updateSession">
