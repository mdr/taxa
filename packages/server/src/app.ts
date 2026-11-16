import { Hono } from "hono"
import { cors } from "hono/cors"
import { HEALTH_PATH } from "@taxa/shared/api/health"
import type { Clock } from "@taxa/shared/clock"
import type { Database } from "./database/database.ts"
import { healthRoute } from "./health.ts"
import type { LogEvent } from "./telemetry/log.ts"

export interface AppOptions {
  database: Database
  clock: Clock
  /** The commit the server was built from. */
  build: string
  logEvent: LogEvent
  /** Pages on other origins allowed to call the API, as the browser tests' pages are. */
  corsOrigins?: string[]
}

export const createApp = ({ database, build, logEvent, corsOrigins }: AppOptions): Hono => {
  const app = new Hono()
  if (corsOrigins) app.use("/api/*", cors({ origin: corsOrigins, credentials: true }))
  app.get(HEALTH_PATH, healthRoute(database, build, logEvent))
  return app
}
