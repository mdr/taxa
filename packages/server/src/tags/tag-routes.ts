import { createRoute, z } from "@hono/zod-openapi"
import type { Clock } from "@taxa/shared/clock"
import { RenameTagRequestSchema, TAGS_PATH, TagSummarySchema } from "@taxa/shared/tasks/tags"
import type { Db } from "../database/database.ts"
import { BEARER, PROBLEMS, json, jsonBody, listOf } from "../http/openapi.ts"
import type { TaxaApp } from "../http/taxa-hono.ts"
import type { ServerLogger } from "../telemetry/log.ts"
import { listTags, renameTag } from "./tag-service.ts"

const routes = {
  list: createRoute({
    method: "get",
    path: TAGS_PATH,
    summary: "The tags on tasks you can see, by name, with how many of their tasks are still to do",
    security: BEARER,
    responses: { 200: json(listOf(TagSummarySchema), "The tags"), ...PROBLEMS }
  }),
  rename: createRoute({
    method: "post",
    path: `${TAGS_PATH}/rename`,
    summary: "Rename a tag on every task you can see that has it",
    description: "Tags match in any case. If a task has the new name already, it ends up with it once.",
    security: BEARER,
    request: jsonBody(RenameTagRequestSchema),
    responses: {
      200: json(z.object({ renamed: z.number().int() }), "How many tasks were renamed"),
      ...PROBLEMS
    }
  })
}

export const tagRoutes = (app: TaxaApp, db: Db, log: ServerLogger, clock: Clock): void => {
  app.openapi(routes.list, async (context) => context.json({ items: await listTags(db, context.var.caller) }, 200))
  app.openapi(routes.rename, async (context) =>
    context.json(await renameTag(db, log, context.var.caller, context.req.valid("json"), clock.now()), 200)
  )
}
