import type { TimeZone } from "@taxa/shared/dates/plain-date"
import type { Config } from "../config.ts"

/** Someone who may sign in, known by the email their identity provider vouches for. */
export interface Person {
  name: string
  /** Lower case. */
  email: string
}

/** Signing in through an OpenID Connect provider, such as Google. */
export interface SignInOptions {
  /** Where people reach Taxa: the callback, the cookie and the origin requests must come from all follow from it. */
  publicUrl: URL
  issuer: URL
  clientId: string
  clientSecret: string
  /** People to make sure Taxa knows by email; anyone it knows by email may sign in, these or not. */
  people: Person[]
  /** The time zone of people made to sign in, until their browser says theirs. */
  timeZone: TimeZone
}

const PERSON = /^(.+?)\s*<([^<>\s]+@[^<>\s]+)>$/

/** "Sam <sam@example.com>, Alex <alex@example.com>" as people. */
export const peopleFrom = (text: string): Person[] =>
  text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .map((entry) => {
      const match = PERSON.exec(entry)
      if (!match) throw new Error(`TAXA_PEOPLE: "${entry}" isn't a name and <email>, such as "Sam <sam@example.com>"`)
      return { name: match[1]!, email: match[2]!.toLowerCase() }
    })

const secretFrom = (config: Config, readFile: (path: string) => string): string => {
  if (config.TAXA_OIDC_CLIENT_SECRET !== undefined && config.TAXA_OIDC_CLIENT_SECRET_FILE !== undefined)
    throw new Error("Give TAXA_OIDC_CLIENT_SECRET or TAXA_OIDC_CLIENT_SECRET_FILE, not both")
  const secret =
    config.TAXA_OIDC_CLIENT_SECRET ??
    (config.TAXA_OIDC_CLIENT_SECRET_FILE === undefined
      ? undefined
      : readFile(config.TAXA_OIDC_CLIENT_SECRET_FILE).trim())
  if (!secret)
    throw new Error("Sign-in needs the client's secret: TAXA_OIDC_CLIENT_SECRET or TAXA_OIDC_CLIENT_SECRET_FILE")
  return secret
}

/**
 * Sign-in, when TAXA_OIDC_CLIENT_ID turns it on: then it needs the rest, and
 * can't be had with the development login, which lets anyone in.
 */
export const signInFrom = (config: Config, readFile: (path: string) => string): SignInOptions | undefined => {
  if (config.TAXA_OIDC_CLIENT_ID === undefined) return undefined
  if (config.TAXA_DEV_USER !== undefined)
    throw new Error("Sign-in and TAXA_DEV_USER don't go together: the development login lets anyone in")
  if (config.TAXA_PUBLIC_URL === undefined)
    throw new Error("Sign-in needs TAXA_PUBLIC_URL, where people reach Taxa, such as https://taxa.example.com")
  const people = peopleFrom(config.TAXA_PEOPLE ?? "")
  return {
    publicUrl: new URL(config.TAXA_PUBLIC_URL),
    issuer: new URL(config.TAXA_OIDC_ISSUER),
    clientId: config.TAXA_OIDC_CLIENT_ID,
    clientSecret: secretFrom(config, readFile),
    people,
    timeZone: config.TAXA_TIME_ZONE
  }
}
