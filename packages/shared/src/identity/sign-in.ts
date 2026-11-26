/** Starts signing in at the identity provider; `then` is the page to come back to. */
export const SIGN_IN_PATH = "/auth/sign-in"

/** Where the identity provider sends people back to. */
export const SIGN_IN_CALLBACK_PATH = "/auth/callback"

/** Signs out, by POST. */
export const SIGN_OUT_PATH = "/auth/sign-out"

/** Why signing in didn't work, as `?sign-in=` on the page it comes back to. */
export enum SignInOutcome {
  /** The provider vouched for someone Taxa doesn't know. */
  NOT_KNOWN = "not-known",
  /** It went wrong, or was given up. */
  FAILED = "failed"
}

export const SIGN_IN_OUTCOME_PARAM = "sign-in"
