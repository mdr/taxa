import type { TimeZone } from "@taxa/shared/dates/plain-date"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { HEALTH_PATH } from "@taxa/shared/api/health"
import { ProblemType, type Problem } from "@taxa/shared/api/problem"
import type { Clock } from "@taxa/shared/clock"
import { agentRoutes } from "./agents/agent-routes.ts"
import { authenticate } from "./auth/authenticate.ts"
import type { Database } from "./database/database.ts"
import { domainRoutes } from "./domains/domain-routes.ts"
import { healthRoute } from "./health.ts"
import { ProblemError } from "./http/problem-error.ts"
import { taxaHono, type TaxaApp } from "./http/taxa-hono.ts"
import { webAppRoutes } from "./http/web-app.ts"
import { taskRoutes } from "./tasks/task-routes.ts"
import { commentRoutes } from "./comments/comment-routes.ts"
import { tagRoutes } from "./tags/tag-routes.ts"
import { sessionRoutes } from "./sessions/session-routes.ts"
import { dayPlanRoutes } from "./days/day-plan-routes.ts"
import { LOG_CODES, type ServerLogger } from "./telemetry/log.ts"
import { ensureUserNamed, userById } from "./users/user-store.ts"

export const OPENAPI_PATH = "/api/openapi.json"

export interface DevLogin {
  /** Everyone who calls without an API key is this person, made the first time. */
  name: string
  timeZone: TimeZone
}

export interface AppOptions {
  database: Database
  clock: Clock
  /** The commit the server was built from. */
  build: string
  logger: ServerLogger
  /** Pages on other origins allowed to call the API, as the browser tests' pages are. */
  corsOrigins?: string[]
  /** Development only: no sign-in, everyone is this person. */
  devLogin?: DevLogin
  /** The built web app's folder, to serve beside the API. */
  webRoot?: string
}

export const createApp = async ({
  database,
  clock,
  build,
  logger,
  corsOrigins,
  devLogin,
  webRoot
}: AppOptions): Promise<TaxaApp> => {
  const { db } = database
  const devUserId = devLogin && (await ensureUserNamed(db, logger, devLogin.name, devLogin.timeZone, clock.now())).id
  const devUser = devUserId
    ? async () => {
        const user = await userById(db, devUserId)
        if (!user) throw new Error("the development login's person has gone")
        return user
      }
    : undefined

  const app = taxaHono()
  if (corsOrigins) {
    app.use("/api/*", cors({ origin: corsOrigins, credentials: true, exposeHeaders: ["ETag"] }))
  }
  app.get(HEALTH_PATH, healthRoute(database, build, logger))
  app.openAPIRegistry.registerComponent("securitySchemes", "bearer", { type: "http", scheme: "bearer" })
  app.doc31(OPENAPI_PATH, {
    openapi: "3.1.0",
    info: { title: "Taxa", version: build, description: "Tasks for people and their agents." }
  })
  app.use("/api/*", authenticate(db, logger, devUser))
  agentRoutes(app, db, logger, clock)
  domainRoutes(app, db, logger, clock)
  taskRoutes(app, db, logger, clock)
  commentRoutes(app, db, logger, clock)
  tagRoutes(app, db, logger, clock)
  sessionRoutes(app, db, logger, clock)
  dayPlanRoutes(app, db, clock)
  if (webRoot) webAppRoutes(app, webRoot)

  app.notFound((context) =>
    context.json<Problem>(
      { type: ProblemType.NOT_FOUND, message: `No such endpoint: ${context.req.method} ${context.req.path}` },
      404
    )
  )
  app.onError((error, context) => {
    if (error instanceof ProblemError) return context.json(error.problem, error.status)
    if (error instanceof HTTPException)
      return context.json<Problem>({ type: ProblemType.INVALID_REQUEST, message: error.message }, 400)
    logger.error(LOG_CODES.request.failed, "a request failed", {
      err: String(error),
      method: context.req.method,
      path: context.req.path
    })
    return context.json({ type: ProblemType.INVALID_REQUEST, message: "Something went wrong on the server." }, 500)
  })
  return app
}
