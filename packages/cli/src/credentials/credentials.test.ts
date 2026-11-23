import { describe, expect, it } from "vite-plus/test"
import { connectionFrom, parseCredentials, type Credentials } from "./credentials.ts"

const PATH = "/home/matt/.config/taxa/credentials"
const file = (text: string, mode = 0o600): { path: string; text: string; mode: number } => ({ path: PATH, text, mode })

describe("parseCredentials", () => {
  it("reads a server and identities, skipping comments, blank lines and quotes", () => {
    expect(
      parseCredentials(
        file(
          [
            "server = http://taxa.local",
            "web = http://web.local",
            "",
            "[default]",
            'key = "taxa_matt"   # me',
            "",
            "# For every Claude session",
            "[claude-code]",
            "key = taxa_claude",
            "server = http://elsewhere",
            "web = http://elsewhere-web"
          ].join("\n")
        )
      )
    ).toEqual({
      server: "http://taxa.local",
      web: "http://web.local",
      identities: new Map([
        ["default", { key: "taxa_matt" }],
        ["claude-code", { key: "taxa_claude", server: "http://elsewhere", web: "http://elsewhere-web" }]
      ])
    })
  })

  it("reads the one-identity form as [default]", () => {
    expect(parseCredentials(file("TAXA_API_KEY=taxa_matt\nTAXA_SERVER=http://taxa.local\n"))).toEqual({
      server: "http://taxa.local",
      identities: new Map([["default", { key: "taxa_matt" }]])
    })
  })

  it("refuses a file others can read, saying how to fix it", () => {
    expect(() => parseCredentials(file("[default]\nkey = taxa_matt", 0o644))).toThrow(
      `${PATH} can be read by others; it holds API keys. Run: chmod 600 ${PATH}`
    )
  })

  it("refuses what it doesn't know, so a typo isn't ignored", () => {
    expect(() => parseCredentials(file("[default]\nkye = taxa_matt"))).toThrow(
      `${PATH}, line 2: expected key = …, server = … or web = ….`
    )
    expect(() => parseCredentials(file("key = taxa_matt"))).toThrow(
      `${PATH}, line 1: expected server = …, web = …, or an identity such as [default].`
    )
    expect(() => parseCredentials(file("[default]\n[default]"))).toThrow(`${PATH}, line 2: [default] is here twice.`)
  })
})

describe("connectionFrom", () => {
  const DEFAULTS = { server: "http://default", web: "http://default-web" }
  const credentials: Credentials = {
    server: "http://file",
    web: "http://file-web",
    identities: new Map([
      ["default", { key: "taxa_matt" }],
      ["claude-code", { key: "taxa_claude", server: "http://claude", web: "http://claude-web" }]
    ])
  }
  const connect = (
    options: { server?: string; as?: string },
    env: Record<string, string> = {}
  ): ReturnType<typeof connectionFrom> =>
    connectionFrom({ server: options.server, as: options.as }, env, credentials, DEFAULTS)
  const withoutFile = { server: undefined, as: undefined }

  it("acts as [default] unless asked otherwise", () => {
    expect(connect({})).toEqual({ server: "http://file", apiKey: "taxa_matt", web: "http://file-web" })
  })

  it("acts as the identity --as or TAXA_AS names, --as first", () => {
    expect(connect({ as: "claude-code" })).toEqual({
      server: "http://claude",
      apiKey: "taxa_claude",
      web: "http://claude-web"
    })
    expect(connect({}, { TAXA_AS: "claude-code" }).apiKey).toBe("taxa_claude")
    expect(connect({ as: "default" }, { TAXA_AS: "claude-code" }).apiKey).toBe("taxa_matt")
  })

  it("prefers TAXA_API_KEY to the file, except to --as", () => {
    expect(connect({}, { TAXA_API_KEY: "taxa_env", TAXA_AS: "claude-code" }).apiKey).toBe("taxa_env")
    expect(connect({ as: "claude-code" }, { TAXA_API_KEY: "taxa_env" }).apiKey).toBe("taxa_claude")
  })

  it("prefers --server, then TAXA_SERVER, to the file's", () => {
    expect(connect({ server: "http://option", as: "claude-code" }, { TAXA_SERVER: "http://env" }).server).toBe(
      "http://option"
    )
    expect(connect({ as: "claude-code" }, { TAXA_SERVER: "http://env" }).server).toBe("http://env")
  })

  it("prefers TAXA_WEB to the file's web app", () => {
    expect(connect({ as: "claude-code" }, { TAXA_WEB: "http://env-web" }).web).toBe("http://env-web")
  })

  it("has no key without a file, and the default server and web app", () => {
    expect(connectionFrom(withoutFile, {}, undefined, DEFAULTS)).toEqual({
      server: "http://default",
      apiKey: undefined,
      web: "http://default-web"
    })
  })

  it("refuses an identity it doesn't have, rather than acting as you", () => {
    expect(() => connect({ as: "claude" })).toThrow(
      'There\'s no identity "claude" in the credentials file; it has default, claude-code.'
    )
    expect(() => connectionFrom(withoutFile, { TAXA_AS: "claude-code" }, undefined, DEFAULTS)).toThrow(
      "There's no identity \"claude-code\": there's no credentials file (see taxa --help)."
    )
  })
})
