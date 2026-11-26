import { describe, expect, it } from "vite-plus/test"
import { configFrom } from "../config.ts"
import { peopleFrom, signInFrom } from "./sign-in-config.ts"

const SIGN_IN = {
  DATABASE_URL: "postgres://x",
  TAXA_PUBLIC_URL: "https://taxa.example.com",
  TAXA_OIDC_CLIENT_ID: "client",
  TAXA_OIDC_CLIENT_SECRET: "secret",
  TAXA_PEOPLE: "Sam <sam@example.com>"
}

const noFiles = (path: string): string => {
  throw new Error(`no file ${path}`)
}

describe("peopleFrom", () => {
  it("reads names and emails, the emails in lower case", () => {
    expect(peopleFrom("Sam <Sam@Example.com>, Alex Smith <alex@example.com>,")).toEqual([
      { name: "Sam", email: "sam@example.com" },
      { name: "Alex Smith", email: "alex@example.com" }
    ])
  })

  it("says which one it can't read", () => {
    expect(() => peopleFrom("Sam <sam@example.com>, alex@example.com")).toThrow(/"alex@example.com"/)
  })
})

describe("signInFrom", () => {
  it("needs no one named: whoever Taxa already knows by email may sign in", () => {
    const { TAXA_PEOPLE: _people, ...rest } = SIGN_IN
    expect(signInFrom(configFrom(rest), noFiles)?.people).toEqual([])
  })

  it("is off without a client, and with one, signs in through Google unless told otherwise", () => {
    expect(signInFrom(configFrom({ DATABASE_URL: "postgres://x" }), noFiles)).toBeUndefined()
    expect(signInFrom(configFrom(SIGN_IN), noFiles)).toMatchObject({
      publicUrl: new URL("https://taxa.example.com"),
      issuer: new URL("https://accounts.google.com"),
      clientId: "client",
      clientSecret: "secret",
      people: [{ name: "Sam", email: "sam@example.com" }],
      timeZone: "Europe/London"
    })
  })

  it("reads the secret from a file, as a systemd credential, without its newline", () => {
    const { TAXA_OIDC_CLIENT_SECRET: _secret, ...rest } = SIGN_IN
    const config = configFrom({ ...rest, TAXA_OIDC_CLIENT_SECRET_FILE: "/run/credentials/taxa/secret" })
    expect(signInFrom(config, () => "from-file\n")?.clientSecret).toBe("from-file")
    expect(() => signInFrom(configFrom({ ...SIGN_IN, TAXA_OIDC_CLIENT_SECRET_FILE: "/x" }), noFiles)).toThrow(
      /not both/
    )
  })

  it("needs where people reach Taxa and a secret, and won't go with the development login", () => {
    const without = (name: keyof typeof SIGN_IN): Record<string, string> =>
      Object.fromEntries(Object.entries(SIGN_IN).filter(([key]) => key !== name))
    expect(() => signInFrom(configFrom(without("TAXA_PUBLIC_URL")), noFiles)).toThrow(/TAXA_PUBLIC_URL/)
    expect(() => signInFrom(configFrom(without("TAXA_OIDC_CLIENT_SECRET")), noFiles)).toThrow(/secret/)
    expect(() => signInFrom(configFrom({ ...SIGN_IN, TAXA_DEV_USER: "Sam" }), noFiles)).toThrow(/TAXA_DEV_USER/)
  })
})
