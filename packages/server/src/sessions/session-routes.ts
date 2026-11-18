import { createRoute, z } from "@hono/zod-openapi"
import type { Clock } from "@taxa/shared/clock"
import {
  CreateSessionRequestSchema,
  CURRENT_SESSION_PATH,
  CurrentSessionSchema,
  SESSIONS_PATH,
  SessionSchema,
  UpdateSessionRequestSchema
} from "@taxa/shared/sessions/session"
import type { Db } from "../database/database.ts"
import { onceFor } from "../http/idempotency.ts"
import { ifMatchVersion } from "../http/if-match.ts"
import { BEARER, IfMatchHeaderSchema, PROBLEMS, json, jsonBody } from "../http/openapi.ts"
import type { TaxaApp } from "../http/taxa-hono.ts"
import type { ServerLogger } from "../telemetry/log.ts"
import { createSession, currentSession, getSession, updateSession } from "./session-service.ts"

const SESSION_PATH = `${SESSIONS_PATH}/{id}`
const IdSchema = z.object({ id: z.string().openapi({ description: "The session's id" }) })

const routes = {
  current: createRoute({
    method: "get",
    path: CURRENT_SESSION_PATH,
    summary: "Your session under way, if you're in one",
    security: BEARER,
    responses: { 200: json(CurrentSessionSchema, "The session, or nothing"), ...PROBLEMS }
  }),
  create: createRoute({
    method: "post",
    path: SESSIONS_PATH,
    summary: "Start a session: a block of time, from now, with the tasks to work through in it",
    description:
      "Starting a task puts it in progress. You can be in one session at a time. Send an Idempotency-Key header to make retries safe.",
    security: BEARER,
    request: jsonBody(CreateSessionRequestSchema),
    responses: { 201: json(SessionSchema, "The new session"), ...PROBLEMS }
  }),
  get: createRoute({
    method: "get",
    path: SESSION_PATH,
    summary: "One of your sessions",
    security: BEARER,
    request: { params: IdSchema },
    responses: { 200: json(SessionSchema, "The session, with its version in the ETag"), ...PROBLEMS }
  }),
  update: createRoute({
    method: "patch",
    path: SESSION_PATH,
    summary: "Finish or stop the task under way, replan, start a task, or end the session",
    description:
      "Finishing a task DONE ticks it off; stopping it, or starting another, puts it back to open; starting one puts it in progress.",
    security: BEARER,
    request: { params: IdSchema, headers: IfMatchHeaderSchema, ...jsonBody(UpdateSessionRequestSchema) },
    responses: { 200: json(SessionSchema, "The session as it is now"), ...PROBLEMS }
  })
}

export const sessionRoutes = (app: TaxaApp, db: Db, log: ServerLogger, clock: Clock): void => {
  app.openapi(routes.current, async (context) => {
    const session = await currentSession(db, context.var.caller)
    return context.json(session ? { session } : {}, 200)
  })
  app.openapi(routes.create, async (context) => {
    const { caller } = context.var
    const now = clock.now()
    const session = await onceFor(db, context, caller, now, () =>
      createSession(db, log, caller, context.req.valid("json"), now)
    )
    return context.json(session, 201, { etag: `"${session.version}"` })
  })
  app.openapi(routes.get, async (context) => {
    const session = await getSession(db, context.var.caller, context.req.valid("param").id)
    return context.json(session, 200, { etag: `"${session.version}"` })
  })
  app.openapi(routes.update, async (context) => {
    const ifMatch = ifMatchVersion(context.req.valid("header")["if-match"])
    const session = await updateSession(
      db,
      log,
      context.var.caller,
      context.req.valid("param").id,
      context.req.valid("json"),
      ifMatch,
      clock.now()
    )
    return context.json(session, 200, { etag: `"${session.version}"` })
  })
}
