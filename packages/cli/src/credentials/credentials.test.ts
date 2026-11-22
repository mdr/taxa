import { describe, expect, it } from "vite-plus/test"
import { connectionFrom, CredentialsError, parseCredentials } from "./credentials.ts"

const file = (text: string, mode = 0o600): { path: string; text: string; mode: number } => ({
  path: "/home/matt/.config/taxa/credentials",
  text,
  mode
})

describe("parseCredentials", () => {
  it("reads a key and a server, skipping comments, blank lines, export and quotes", () => {
    expect(
      parseCredentials(file('# Claude Code\n\nexport TAXA_API_KEY="taxa_abc"\nTAXA_SERVER = http://taxa.local\n'))
    ).toEqual({ apiKey: "taxa_abc", server: "http://taxa.local" })
  })

  it("refuses a file others can read, saying how to fix it", () => {
    expect(() => parseCredentials(file("TAXA_API_KEY=taxa_abc", 0o644))).toThrow(
      new CredentialsError(
        "/home/matt/.config/taxa/credentials can be read by others; it holds an API key. Run: chmod 600 /home/matt/.config/taxa/credentials"
      )
    )
  })

  it("refuses a line it doesn't know, so a typo isn't ignored", () => {
    expect(() => parseCredentials(file("TAXA_API_KEY=taxa_abc\nTAXA_APIKEY=taxa_def"))).toThrow(
      "/home/matt/.config/taxa/credentials, line 2: expected TAXA_API_KEY=… or TAXA_SERVER=…, and nothing else."
    )
  })
})

describe("connectionFrom", () => {
  const fromFile = { apiKey: "taxa_file", server: "http://file" }

  it("prefers --server, then the environment, then the file, then the default", () => {
    expect(connectionFrom("http://option", { TAXA_SERVER: "http://env" }, fromFile, "http://default").server).toBe(
      "http://option"
    )
    expect(connectionFrom(undefined, { TAXA_SERVER: "http://env" }, fromFile, "http://default").server).toBe(
      "http://env"
    )
    expect(connectionFrom(undefined, {}, fromFile, "http://default").server).toBe("http://file")
    expect(connectionFrom(undefined, {}, {}, "http://default")).toEqual({
      server: "http://default",
      apiKey: undefined
    })
  })

  it("prefers TAXA_API_KEY to the file's key", () => {
    expect(connectionFrom(undefined, { TAXA_API_KEY: "taxa_env" }, fromFile, "http://default").apiKey).toBe("taxa_env")
    expect(connectionFrom(undefined, {}, fromFile, "http://default").apiKey).toBe("taxa_file")
  })
})
