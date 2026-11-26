import type { Context } from "hono"
import type { CookieOptions } from "hono/utils/cookie"
import type { SignInOptions } from "./sign-in-config.ts"

/** The cookies signing in uses, named and set for where people reach Taxa. */
export interface SignInCookies {
  /** Who the browser is signed in as. */
  signIn: string
  /** What it carried to the provider and back. */
  flow: string
  attributes: CookieOptions
  /** Whether a request came from Taxa's own pages, as its browser says: anything that changes data must. */
  fromOurPages: (context: Context) => boolean
}

/**
 * Over HTTPS, `__Host-` cookies: secure, for this host alone, and for all of
 * it. Lax, so the provider's redirect back brings them, but other sites'
 * requests don't. Plain HTTP is only for the tests.
 */
export const signInCookies = ({ publicUrl }: SignInOptions): SignInCookies => {
  const secure = publicUrl.protocol === "https:"
  const prefix = secure ? "__Host-" : ""
  return {
    signIn: `${prefix}taxa`,
    flow: `${prefix}taxa-sign-in`,
    attributes: { path: "/", httpOnly: true, secure, sameSite: "Lax" },
    fromOurPages: (context) => context.req.header("origin") === publicUrl.origin
  }
}
