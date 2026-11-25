import { createRoute, z } from "@hono/zod-openapi"
import type { Clock } from "@taxa/shared/clock"
import {
  AddCommentRequestSchema,
  COMMENTS_PATH,
  CommentSchema,
  EditCommentRequestSchema,
  UndoCommentRequestSchema
} from "@taxa/shared/comments/comment"
import { CommentIdSchema } from "@taxa/shared/ids"
import { TASKS_PATH } from "@taxa/shared/tasks/task"
import type { Db } from "../database/database.ts"
import { onceFor } from "../http/idempotency.ts"
import { ifMatchVersion } from "../http/if-match.ts"
import { BEARER, IfMatchHeaderSchema, PROBLEMS, json, jsonBody, listOf } from "../http/openapi.ts"
import { ProblemSchema } from "@taxa/shared/api/problem"
import type { TaxaApp } from "../http/taxa-hono.ts"
import type { ServerLogger } from "../telemetry/log.ts"
import { addComment, deleteComment, editComment, listComments, restoreComment, undoComment } from "./comment-service.ts"

const TaskRefSchema = z.object({
  ref: z.string().openapi({ description: "The task: H-142, 142 (the prefix is optional) or its id", example: "H-142" })
})
const IdSchema = z.object({ id: CommentIdSchema })
const COMMENT_PATH = `${COMMENTS_PATH}/{id}`
const CHANGE_PROBLEMS = { ...PROBLEMS, 403: json(ProblemSchema, "Someone else wrote it") }

const routes = {
  list: createRoute({
    method: "get",
    path: `${TASKS_PATH}/{ref}/comments`,
    summary: "A task's comments, oldest first",
    security: BEARER,
    request: { params: TaskRefSchema },
    responses: { 200: json(listOf(CommentSchema), "Its comments, leaving out deleted ones"), ...PROBLEMS }
  }),
  add: createRoute({
    method: "post",
    path: `${TASKS_PATH}/{ref}/comments`,
    summary: "Comment on a task: what's happened, or progress on it",
    description:
      "Doesn't change the task, nor its version. Send an Idempotency-Key header, or choose the id, to make retries safe.",
    security: BEARER,
    request: { params: TaskRefSchema, ...jsonBody(AddCommentRequestSchema) },
    responses: { 201: json(CommentSchema, "The new comment"), ...PROBLEMS }
  }),
  edit: createRoute({
    method: "patch",
    path: COMMENT_PATH,
    summary: "Change what a comment of yours says",
    security: BEARER,
    request: { params: IdSchema, headers: IfMatchHeaderSchema, ...jsonBody(EditCommentRequestSchema) },
    responses: { 200: json(CommentSchema, "The comment as it is now"), ...CHANGE_PROBLEMS }
  }),
  delete: createRoute({
    method: "delete",
    path: COMMENT_PATH,
    summary: "Delete a comment of yours (it can be restored)",
    security: BEARER,
    request: { params: IdSchema, headers: IfMatchHeaderSchema },
    responses: { 200: json(CommentSchema, "The deleted comment"), ...CHANGE_PROBLEMS }
  }),
  undo: createRoute({
    method: "post",
    path: `${COMMENT_PATH}/undo`,
    summary: "Undo the change that brought a comment of yours to a version",
    description:
      "A comment added or restored is deleted, a deleted one restored, and an edit put back, unless it's been changed since (409). The undo is a change too: undo it to redo.",
    security: BEARER,
    request: { params: IdSchema, ...jsonBody(UndoCommentRequestSchema) },
    responses: { 200: json(CommentSchema, "The comment as it is now"), ...CHANGE_PROBLEMS }
  }),
  restore: createRoute({
    method: "post",
    path: `${COMMENT_PATH}/restore`,
    summary: "Restore a comment of yours that was deleted",
    security: BEARER,
    request: { params: IdSchema },
    responses: { 200: json(CommentSchema, "The restored comment"), ...CHANGE_PROBLEMS }
  })
}

export const commentRoutes = (app: TaxaApp, db: Db, log: ServerLogger, clock: Clock): void => {
  app.openapi(routes.list, async (context) =>
    context.json({ items: await listComments(db, context.var.caller, context.req.valid("param").ref) }, 200)
  )
  app.openapi(routes.add, async (context) => {
    const { caller } = context.var
    const now = clock.now()
    const { ref } = context.req.valid("param")
    const comment = await onceFor(db, context, caller, now, () =>
      addComment(db, log, caller, ref, context.req.valid("json"), now)
    )
    return context.json(comment, 201, { etag: `"${comment.version}"` })
  })
  app.openapi(routes.edit, async (context) => {
    const ifMatch = ifMatchVersion(context.req.valid("header")["if-match"])
    const { id } = context.req.valid("param")
    const comment = await editComment(db, log, context.var.caller, id, context.req.valid("json"), ifMatch, clock.now())
    return context.json(comment, 200, { etag: `"${comment.version}"` })
  })
  app.openapi(routes.delete, async (context) => {
    const ifMatch = ifMatchVersion(context.req.valid("header")["if-match"])
    const comment = await deleteComment(
      db,
      log,
      context.var.caller,
      context.req.valid("param").id,
      ifMatch,
      clock.now()
    )
    return context.json(comment, 200)
  })
  app.openapi(routes.undo, async (context) => {
    const { id } = context.req.valid("param")
    const comment = await undoComment(db, log, context.var.caller, id, context.req.valid("json").version, clock.now())
    return context.json(comment, 200, { etag: `"${comment.version}"` })
  })
  app.openapi(routes.restore, async (context) =>
    context.json(await restoreComment(db, log, context.var.caller, context.req.valid("param").id, clock.now()), 200)
  )
}
