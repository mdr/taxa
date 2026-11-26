/**
 * A stand-in OpenID Connect provider, as Google is, over plain HTTP on a
 * spare port: it signs in whoever the test says, at once, and answers the
 * server's token request with a real signed ID token, so sign-in is tested
 * the whole way through without reaching anywhere.
 */
import type { AddressInfo } from "node:net"
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto"
import { serve, type ServerType } from "@hono/node-server"
import { Hono, type Context } from "hono"

/** Who signs in at the provider. */
export interface Account {
  email: string
  /** Whether the provider vouches that the email is theirs: it does unless told otherwise. */
  emailVerified?: boolean
}

interface Grant {
  account: Account
  nonce: string | undefined
  challenge: string | undefined
  redirectUri: string
}

const KEY_ID = "test-key"
const TOKEN_LIFE_SECONDS = 300

const base64url = (value: string | Buffer): string => Buffer.from(value).toString("base64url")

export class FakeIdentityProvider {
  readonly clientId = "taxa-test-client"
  readonly clientSecret = "taxa-test-secret"
  readonly issuer: URL
  readonly #server: ServerType
  readonly #grants = new Map<string, Grant>()
  readonly #keys = generateKeyPairSync("rsa", { modulusLength: 2048 })
  #next: Account | undefined
  /** What the token endpoint was asked, for tests that check how. */
  readonly tokenRequests: URLSearchParams[] = []

  private constructor(server: ServerType, port: number) {
    this.#server = server
    this.issuer = new URL(`http://127.0.0.1:${port}`)
  }

  static async start(): Promise<FakeIdentityProvider> {
    // The provider knows its port only once listening; its routes find it here by then.
    const started: { provider?: FakeIdentityProvider } = {}
    const app = new Hono()
    app.get("/.well-known/openid-configuration", (context) => context.json(started.provider!.#metadata()))
    app.get("/jwks", (context) => context.json({ keys: [started.provider!.#publicKey()] }))
    app.get("/authorize", (context) => started.provider!.#authorize(context))
    app.post("/token", async (context) => started.provider!.#token(context))
    const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" })
    const port = await new Promise<number>((resolve) =>
      server.once("listening", () => resolve((server.address() as AddressInfo).port))
    )
    started.provider = new FakeIdentityProvider(server, port)
    return started.provider
  }

  /** Whoever next comes to sign in is this account; with none, they turn it down. */
  signsInAs(account: Account | undefined): void {
    this.#next = account
  }

  async close(): Promise<void> {
    await new Promise((resolve) => this.#server.close(resolve))
  }

  #url(path: string): string {
    return new URL(path, this.issuer).href
  }

  #metadata(): Record<string, unknown> {
    return {
      issuer: this.issuer.href.replace(/\/$/, ""),
      authorization_endpoint: this.#url("/authorize"),
      token_endpoint: this.#url("/token"),
      jwks_uri: this.#url("/jwks"),
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"]
    }
  }

  #publicKey(): Record<string, unknown> {
    return { ...this.#keys.publicKey.export({ format: "jwk" }), kid: KEY_ID, alg: "RS256", use: "sig" }
  }

  #authorize(context: Context): Response {
    const query = context.req.query()
    const back = new URL(query["redirect_uri"] ?? "")
    if (query["state"]) back.searchParams.set("state", query["state"])
    if (query["client_id"] !== this.clientId || !this.#next) {
      back.searchParams.set("error", "access_denied")
      return context.redirect(back.href)
    }
    const code = randomBytes(16).toString("hex")
    this.#grants.set(code, {
      account: this.#next,
      nonce: query["nonce"],
      challenge: query["code_challenge"],
      redirectUri: back.origin + back.pathname
    })
    back.searchParams.set("code", code)
    return context.redirect(back.href)
  }

  #clientChecksOut(context: Context, form: URLSearchParams): boolean {
    const basic = /^Basic (.+)$/.exec(context.req.header("authorization") ?? "")?.[1]
    const [id, secret] = basic
      ? Buffer.from(basic, "base64").toString().split(":").map(decodeURIComponent)
      : [form.get("client_id"), form.get("client_secret")]
    return id === this.clientId && secret === this.clientSecret
  }

  async #token(context: Context): Promise<Response> {
    const form = new URLSearchParams(await context.req.text())
    this.tokenRequests.push(form)
    const grant = this.#grants.get(form.get("code") ?? "")
    this.#grants.delete(form.get("code") ?? "")
    const verifier = form.get("code_verifier") ?? ""
    const challenge = base64url(createHash("sha256").update(verifier).digest())
    if (
      !grant ||
      !this.#clientChecksOut(context, form) ||
      grant.challenge !== challenge ||
      grant.redirectUri !== form.get("redirect_uri")
    )
      return context.json({ error: "invalid_grant" }, 400)
    return context.json({
      access_token: randomBytes(16).toString("hex"),
      token_type: "Bearer",
      expires_in: TOKEN_LIFE_SECONDS,
      id_token: this.#idToken(grant)
    })
  }

  /** Signed as the provider: timed by the real clock, which is what the server checks it by. */
  #idToken({ account, nonce }: Grant): string {
    const now = Math.floor(Date.now() / 1000)
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KEY_ID }))
    const payload = base64url(
      JSON.stringify({
        iss: this.issuer.href.replace(/\/$/, ""),
        sub: createHash("sha256").update(account.email).digest("hex").slice(0, 21),
        aud: this.clientId,
        iat: now,
        exp: now + TOKEN_LIFE_SECONDS,
        ...(nonce !== undefined && { nonce }),
        email: account.email,
        email_verified: account.emailVerified ?? true
      })
    )
    const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(this.#keys.privateKey)
    return `${header}.${payload}.${base64url(signature)}`
  }
}
