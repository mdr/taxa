import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import { SIGN_IN_OUTCOME_PARAM, SIGN_IN_PATH, SIGN_OUT_PATH, SignInOutcome } from "@taxa/shared/identity/sign-in"
import { apiBase } from "../api/api-base.ts"

/** The API turned the page away for not being signed in. */
export const isSignedOut = (error: unknown): boolean => error instanceof TaxaApiError && error.status === 401

/** Where to start signing in, to come back to this page, without what the last try said. */
export const signInHref = (path: string, search: string): string => {
  const query = new URLSearchParams(search)
  query.delete(SIGN_IN_OUTCOME_PARAM)
  const rest = query.size > 0 ? `?${query}` : ""
  return `${apiBase()}${SIGN_IN_PATH}?then=${encodeURIComponent(`${path}${rest}`)}`
}

/** What the last try at signing in said, if it didn't work. */
const PROBLEMS: Record<string, string> = {
  [SignInOutcome.NOT_KNOWN]:
    "Taxa doesn't know that account. Sign in with one it does, or ask whoever runs Taxa to add you.",
  [SignInOutcome.FAILED]: "Signing in didn't work. Try again."
}

export const signInProblem = (search: string): string | undefined =>
  PROBLEMS[new URLSearchParams(search).get(SIGN_IN_OUTCOME_PARAM) ?? ""]

/** Signs this browser out, then starts afresh. */
export const signOut = async (): Promise<void> => {
  await fetch(`${apiBase()}${SIGN_OUT_PATH}`, { method: "POST", credentials: "include" })
  globalThis.location.assign("/")
}
