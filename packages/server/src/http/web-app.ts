import { readFileSync } from "node:fs"
import { join } from "node:path"
import { serveStatic } from "@hono/node-server/serve-static"
import type { TaxaApp } from "./taxa-hono.ts"

/** Vite names built assets by their contents, so a browser may keep them for good. */
const ASSETS = "/assets/"
const KEEP_FOREVER = "public, max-age=31536000, immutable"
const CHECK_FIRST = "no-cache"

const isApi = (path: string): boolean => path === "/api" || path.startsWith("/api/")

/**
 * The built web app, from its folder: its files as they are, and its index
 * page for any other path, which the app routes itself (`/today`). Register
 * after the API, which keeps its own paths and its JSON 404s.
 */
export const webAppRoutes = (app: TaxaApp, root: string): void => {
  const index = readFileSync(join(root, "index.html"), "utf8")
  app.use("*", async (context, next) => {
    if (isApi(context.req.path)) return next()
    await next()
    if (context.res.ok)
      context.header("Cache-Control", context.req.path.startsWith(ASSETS) ? KEEP_FOREVER : CHECK_FIRST)
  })
  app.use("*", serveStatic({ root }))
  app.on(["GET", "HEAD"], "*", async (context, next) => {
    if (isApi(context.req.path) || context.req.path.startsWith(ASSETS)) return next()
    return context.html(index)
  })
}
