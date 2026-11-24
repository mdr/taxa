import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

const INDEX = "<!doctype html><title>Taxa</title>"
const SCRIPT = "console.log('taxa')"
const SECRET = "not to be served"

const folder = mkdtempSync(join(tmpdir(), "taxa-web-"))
const webRoot = join(folder, "dist")
mkdirSync(join(webRoot, "assets"), { recursive: true })
writeFileSync(join(webRoot, "index.html"), INDEX)
writeFileSync(join(webRoot, "assets", "app-1a2b.js"), SCRIPT)
writeFileSync(join(folder, "secret.txt"), SECRET)

describe("the built web app, served beside the API", () => {
  const it = useInProcessServer({ webRoot })
  afterAll(() => rmSync(folder, { recursive: true, force: true }))

  it("serves its index page at its root, checked again each time", async ({ server }) => {
    const response = await fetch(`${server.httpUrl}/`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(INDEX)
    expect(response.headers.get("Cache-Control")).toBe("no-cache")
  })

  it("serves the index page for the paths the app routes itself", async ({ server }) => {
    for (const path of ["/today", "/tasks/H-142", "/bin"]) {
      const response = await fetch(`${server.httpUrl}${path}`)
      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toContain("text/html")
      expect(await response.text()).toBe(INDEX)
    }
  })

  it("serves its assets as they are, kept for good", async ({ server }) => {
    const response = await fetch(`${server.httpUrl}/assets/app-1a2b.js`)
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("javascript")
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable")
    expect(await response.text()).toBe(SCRIPT)
  })

  it("says an asset that isn't there is missing, rather than sending the page", async ({ server }) => {
    const response = await fetch(`${server.httpUrl}/assets/gone-9z9z.js`)
    expect(response.status).toBe(404)
    expect(response.headers.has("Cache-Control")).toBe(false)
  })

  it("leaves the API's paths to the API", async ({ server }) => {
    const response = await fetch(`${server.httpUrl}/api/no-such-thing`)
    expect(response.headers.get("Content-Type")).toContain("application/json")
    expect(((await response.json()) as { type: string }).type).toBe(ProblemType.UNAUTHENTICATED)
    expect((await server.health()).build).toBe("test")
  })

  it("serves nothing from outside its folder", async ({ server }) => {
    for (const path of ["/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt", "/assets/..%2f..%2fsecret.txt"]) {
      const response = await fetch(`${server.httpUrl}${path}`)
      expect(await response.text()).not.toContain(SECRET)
    }
  })

  it("only answers reading", async ({ server }) => {
    expect((await fetch(`${server.httpUrl}/today`, { method: "POST" })).status).toBe(404)
  })
})
