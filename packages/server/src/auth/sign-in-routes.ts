import type { Context } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import * as oidc from "openid-client"
import { z } from "zod"
import type { Clock } from "@taxa/shared/clock"
import {
  SIGN_IN_CALLBACK_PATH,
  SIGN_IN_OUTCOME_PARAM,
  SIGN_IN_PATH,
  SIGN_OUT_PATH,
  SignInOutcome
} from "@taxa/shared/identity/sign-in"
import type { Db } from "../database/database.ts"
import type { TaxaApp } from "../http/taxa-hono.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"
import { userByEmail } from "../users/user-store.ts"
import type { SignInOptions } from "./sign-in-config.ts"
import { endSignIn, SIGN_IN_LAPSES_MS, startSignIn } from "./sign-in-store.ts"
import { signInCookies, type SignInCookies } from "./sign-in-cookies.ts"

/** How long someone has at their provider before coming back. */
const FLOW_SECONDS = 10 * 60

/** What a browser carries to its provider and back, to tie the answer to the question. */
const FlowSchema = z.object({ state: z.string(), verifier: z.string(), nonce: z.string(), then: z.string() })

type Flow = z.infer<typeof FlowSchema>

/** A page of Taxa's own to come back to, never somewhere else: "/today", not "//evil.example". */
const pageOrHome = (then: string | undefined): string =>
  then?.startsWith("/") && !then.startsWith("//") && !then.startsWith("/\\") ? then : "/"

const encodeFlow = (flow: Flow): string => Buffer.from(JSON.stringify(flow)).toString("base64url")

const decodeFlow = (cookie: string | undefined): Flow | undefined => {
  if (cookie === undefined) return undefined
  try {
    return FlowSchema.parse(JSON.parse(Buffer.from(cookie, "base64url").toString()))
  } catch {
    return undefined
  }
}

/** The provider's configuration, found the first time someone signs in and kept; found again after a failure. */
const providerOf = (options: SignInOptions): (() => Promise<oidc.Configuration>) => {
  let found: Promise<oidc.Configuration> | undefined
  return () => {
    found ??= oidc
      .discovery(options.issuer, options.clientId, options.clientSecret, undefined, {
        // Only the tests' stand-in provider is reached over plain HTTP: the deprecation is a warning to that effect.
        // oxlint-disable-next-line typescript/no-deprecated
        execute: options.issuer.protocol === "http:" ? [oidc.allowInsecureRequests] : []
      })
      .catch((error: unknown) => {
        found = undefined
        throw error
      })
    return found
  }
}

interface SignInContext {
  db: Db
  log: ServerLogger
  clock: Clock
  options: SignInOptions
  cookies: SignInCookies
  provider: () => Promise<oidc.Configuration>
}

const callbackUrl = (options: SignInOptions): string => new URL(SIGN_IN_CALLBACK_PATH, options.publicUrl).href

const backTo = (context: Context, options: SignInOptions, page: string, outcome?: SignInOutcome): Response => {
  const asked = new URL(page, options.publicUrl)
  // URLs drop tabs and newlines, so "/\t/evil.example" is "//evil.example": what it comes to is what counts.
  const url = asked.origin === options.publicUrl.origin ? asked : new URL("/", options.publicUrl)
  if (outcome) url.searchParams.set(SIGN_IN_OUTCOME_PARAM, outcome)
  return context.redirect(url.href)
}

const begin = async (context: Context, { log, options, cookies, provider }: SignInContext): Promise<Response> => {
  const then = pageOrHome(context.req.query("then"))
  let config: oidc.Configuration
  try {
    config = await provider()
  } catch (error) {
    log.error(LOG_CODES.signIn.failed, "couldn't reach the identity provider", { err: String(error) })
    return backTo(context, options, then, SignInOutcome.FAILED)
  }
  const flow = { state: oidc.randomState(), verifier: oidc.randomPKCECodeVerifier(), nonce: oidc.randomNonce(), then }
  setCookie(context, cookies.flow, encodeFlow(flow), { ...cookies.attributes, maxAge: FLOW_SECONDS })
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl(options),
    scope: "openid email",
    code_challenge: await oidc.calculatePKCECodeChallenge(flow.verifier),
    code_challenge_method: "S256",
    state: flow.state,
    nonce: flow.nonce,
    prompt: "select_account"
  })
  return context.redirect(url.href)
}

/** The email the provider vouches for, in lower case, if it vouches for one. */
const vouchedEmail = async (config: oidc.Configuration, current: URL, flow: Flow): Promise<string | undefined> => {
  const tokens = await oidc.authorizationCodeGrant(config, current, {
    pkceCodeVerifier: flow.verifier,
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    idTokenExpected: true
  })
  const claims = tokens.claims()
  return claims?.["email_verified"] === true && typeof claims["email"] === "string"
    ? claims["email"].toLowerCase()
    : undefined
}

const finish = async (
  context: Context,
  { db, log, clock, options, cookies, provider }: SignInContext
): Promise<Response> => {
  const flow = decodeFlow(getCookie(context, cookies.flow))
  deleteCookie(context, cookies.flow, cookies.attributes)
  if (!flow) {
    log.warn(LOG_CODES.signIn.failed, "came back from the identity provider without having set out")
    return backTo(context, options, "/", SignInOutcome.FAILED)
  }
  // As the provider sent it, to where people reach Taxa, whatever proxy it came through since.
  const request = new URL(context.req.url)
  const current = new URL(`${request.pathname}${request.search}`, options.publicUrl)
  let email: string | undefined
  try {
    email = await vouchedEmail(await provider(), current, flow)
  } catch (error) {
    log.warn(LOG_CODES.signIn.failed, "the identity provider's answer didn't check out", { err: String(error) })
    return backTo(context, options, flow.then, SignInOutcome.FAILED)
  }
  const user = email === undefined ? undefined : await userByEmail(db, email)
  if (!user) {
    log.warn(LOG_CODES.signIn.refused, "someone Taxa doesn't know tried to sign in")
    return backTo(context, options, flow.then, SignInOutcome.NOT_KNOWN)
  }
  const secret = await startSignIn(db, user.id, clock.now())
  setCookie(context, cookies.signIn, secret, { ...cookies.attributes, maxAge: SIGN_IN_LAPSES_MS / 1000 })
  log.info(LOG_CODES.signIn.signedIn, "signed in", { userId: user.id })
  return backTo(context, options, flow.then)
}

const signOut = async (context: Context, { db, log, clock, cookies }: SignInContext): Promise<Response> => {
  if (!cookies.fromOurPages(context)) return context.body("", 403)
  const secret = getCookie(context, cookies.signIn)
  if (secret !== undefined) await endSignIn(db, secret, clock.now())
  deleteCookie(context, cookies.signIn, cookies.attributes)
  log.info(LOG_CODES.signIn.signedOut, "signed out")
  return context.text("Signed out.")
}

/** Signing in through the identity provider and back, and signing out. Outside /api: these are pages, not the API. */
export const signInRoutes = (app: TaxaApp, db: Db, log: ServerLogger, clock: Clock, options: SignInOptions): void => {
  const sign: SignInContext = {
    db,
    log,
    clock,
    options,
    cookies: signInCookies(options),
    provider: providerOf(options)
  }
  app.get(SIGN_IN_PATH, (context) => begin(context, sign))
  app.get(SIGN_IN_CALLBACK_PATH, (context) => finish(context, sign))
  app.post(SIGN_OUT_PATH, (context) => signOut(context, sign))
}
