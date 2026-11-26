import { afterAll, beforeAll, beforeEach, describe, expect, it as plainIt } from "vite-plus/test"
import { timeZone } from "@taxa/shared/dates/plain-date"
import { ME_PATH, MeSchema } from "@taxa/shared/identity/actor"
import { SIGN_IN_PATH, SIGN_OUT_PATH } from "@taxa/shared/identity/sign-in"
import { DOMAINS_PATH } from "@taxa/shared/domains/domain"
import { ProblemType } from "@taxa/shared/api/problem"
import { CookieBrowser } from "../test-support/cookie-browser.ts"
import { FakeIdentityProvider } from "../test-support/fake-identity-provider.ts"
import type { InProcessServer } from "../test-support/in-process-server.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"
import { pgliteDatabase, warmUpDatabases } from "../test-support/pglite-database.ts"
import { createLogger, type LogRecord } from "@taxa/shared/telemetry/log"
import { FakeClock } from "@taxa/shared/test-support/fake-clock"
import type { ServerLogCode } from "../telemetry/log.ts"
import { ensurePeople, ensureUserNamed, userByEmail } from "../users/user-store.ts"

const DAY = 24 * 60 * 60 * 1000
const MATT = "matt@example.com"

describe("signing in", () => {
  let provider: FakeIdentityProvider
  beforeAll(async () => {
    provider = await FakeIdentityProvider.start()
  })
  afterAll(() => provider.close())
  beforeEach(() => provider.signsInAs({ email: MATT }))

  const it = useInProcessServer({
    signIn: (publicUrl) => ({
      publicUrl,
      issuer: provider.issuer,
      clientId: provider.clientId,
      clientSecret: provider.clientSecret,
      people: [{ name: "Matt", email: MATT }],
      timeZone: timeZone("Europe/London")
    })
  })

  const signIn = async (server: InProcessServer, then = "/today"): Promise<{ browser: CookieBrowser; url: URL }> => {
    const browser = new CookieBrowser()
    const { url } = await browser.open(`${server.httpUrl}${SIGN_IN_PATH}?then=${encodeURIComponent(then)}`)
    return { browser, url }
  }

  const me = async (server: InProcessServer, browser: CookieBrowser): Promise<Response> =>
    browser.request(`${server.httpUrl}${ME_PATH}`)

  const addDomain = (server: InProcessServer, browser: CookieBrowser, from?: string): Promise<Response> =>
    browser.request(`${server.httpUrl}${DOMAINS_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Home", prefix: "H" }),
      from
    })

  it("takes someone Taxa knows to their provider and back to the page they were on, signed in", async ({ server }) => {
    const { browser, url } = await signIn(server)

    expect(browser.visited.map(({ origin }) => origin)).toContain(provider.issuer.origin)
    expect(url.href).toBe(`${server.httpUrl}/today`)
    expect([...browser.cookies.keys()]).toEqual(["taxa"])
    const response = await me(server, browser)
    expect(response.status).toBe(200)
    expect(MeSchema.parse(await response.json())).toMatchObject({ user: { name: "Matt" }, signedIn: true })
    expect(server.logs.map(({ code }) => code)).toContain("signIn.signedIn")
  })

  it("uses PKCE and the client's secret, so a stolen code alone is no use", async ({ server }) => {
    await signIn(server)
    const asked = provider.tokenRequests.at(-1)
    expect(asked?.get("code_verifier")).toMatch(/^[\w-]{43,}$/)
    expect(asked?.get("redirect_uri")).toBe(`${server.httpUrl}/auth/callback`)
  })

  it("turns away someone Taxa doesn't know, or whose email the provider doesn't vouch for", async ({ server }) => {
    provider.signsInAs({ email: "stranger@example.com" })
    const stranger = await signIn(server)
    expect(stranger.url.href).toBe(`${server.httpUrl}/today?sign-in=not-known`)
    expect((await me(server, stranger.browser)).status).toBe(401)

    provider.signsInAs({ email: MATT, emailVerified: false })
    const unverified = await signIn(server)
    expect(unverified.url.searchParams.get("sign-in")).toBe("not-known")
    expect(unverified.browser.cookies.size).toBe(0)
    expect(server.logs.filter(({ code }) => code === "signIn.refused")).toHaveLength(2)
  })

  it("knows people by email whatever its case", async ({ server }) => {
    provider.signsInAs({ email: "Matt@Example.com" })
    const { browser } = await signIn(server)
    expect((await me(server, browser)).status).toBe(200)
  })

  it("says it didn't work when the provider turns them down, or the answer isn't for this browser", async ({
    server
  }) => {
    provider.signsInAs(undefined)
    const declined = await signIn(server)
    expect(declined.url.href).toBe(`${server.httpUrl}/today?sign-in=failed`)

    provider.signsInAs({ email: MATT })
    const browser = new CookieBrowser()
    const started = await browser.request(`${server.httpUrl}${SIGN_IN_PATH}`)
    const atProvider = await browser.request(started.headers.get("location") ?? "")
    browser.setCookie("taxa-sign-in", undefined)
    const { url } = await browser.open(atProvider.headers.get("location") ?? "")
    expect(url.searchParams.get("sign-in")).toBe("failed")
    expect((await me(server, browser)).status).toBe(401)
  })

  it("comes back only to Taxa's own pages", async ({ server }) => {
    for (const then of ["//evil.example/x", "https://evil.example/", "/\\evil.example", "/\t/evil.example"]) {
      const { url } = await signIn(server, then)
      expect(url.href).toBe(`${server.httpUrl}/`)
    }
  })

  it("lets changes be made only from Taxa's own pages", async ({ server }) => {
    const { browser } = await signIn(server)

    const elsewhere = await addDomain(server, browser, "https://evil.example")
    expect(elsewhere.status).toBe(403)
    expect(await elsewhere.json()).toMatchObject({ type: ProblemType.FORBIDDEN })
    expect((await addDomain(server, browser)).status).toBe(403)
    expect((await addDomain(server, browser, server.httpUrl)).status).toBe(201)
  })

  it("signs out, after which the cookie signs no one in", async ({ server }) => {
    const { browser } = await signIn(server)
    const cookie = browser.cookies.get("taxa")

    expect((await browser.request(`${server.httpUrl}${SIGN_OUT_PATH}`, { method: "POST" })).status).toBe(403)
    const out = await browser.request(`${server.httpUrl}${SIGN_OUT_PATH}`, { method: "POST", from: server.httpUrl })
    expect(out.status).toBe(200)
    expect(browser.cookies.has("taxa")).toBe(false)
    browser.setCookie("taxa", cookie)
    expect((await me(server, browser)).status).toBe(401)
  })

  it("lapses after a month unused, but not while it's used", async ({ server }) => {
    const kept = await signIn(server)
    const left = await signIn(server)

    for (let week = 0; week < 6; week++) {
      server.advance(7 * DAY)
      expect((await me(server, kept.browser)).status).toBe(200)
    }
    expect((await me(server, left.browser)).status).toBe(401)
  })

  it("doesn't let an API key be mistaken for a sign-in, or the other way round", async ({ server }) => {
    const browser = new CookieBrowser()
    browser.setCookie("taxa", "taxa_not-a-real-key")
    expect((await me(server, browser)).status).toBe(401)
  })
})

describe("the people who may sign in", () => {
  beforeAll(warmUpDatabases, 60_000)

  plainIt("are known by their email: someone of that name without one takes it, and anyone else is made", async () => {
    const database = await pgliteDatabase()
    try {
      const { db } = database
      const logs: LogRecord[] = []
      const log = createLogger<ServerLogCode>(new FakeClock(0), [(record) => logs.push(record)])
      const london = timeZone("Europe/London")
      const matt = await ensureUserNamed(db, log, "Matt", london, 0)
      const people = [
        { name: "Matt", email: MATT },
        { name: "Sam", email: "sam@example.com" }
      ]

      await ensurePeople(db, log, people, london, 0)
      await ensurePeople(db, log, people, london, 0)

      expect(await userByEmail(db, MATT)).toEqual(matt)
      expect(await userByEmail(db, "sam@example.com")).toMatchObject({ name: "Sam" })
      expect(logs.filter(({ code }) => code === "user.maySignIn")).toHaveLength(2)
      expect(logs.filter(({ code }) => code === "user.created")).toHaveLength(2)
    } finally {
      await database.close()
    }
  })
})

describe("signing in with no one named", () => {
  const it = useInProcessServer({
    signIn: (publicUrl) => ({
      publicUrl,
      issuer: new URL("http://127.0.0.1:9"),
      clientId: "client",
      clientSecret: "secret",
      people: [],
      timeZone: timeZone("Europe/London")
    })
  })

  it("starts, warning that no one can sign in while Taxa knows no one by email", async ({ server }) => {
    expect((await server.health()).status).toBe("OK")
    expect(server.logs.map(({ code }) => code)).toContain("signIn.noOneCan")
  })
})
