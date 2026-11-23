import { createRoute, z } from "@hono/zod-openapi"
import { ActivitySchema } from "@taxa/shared/activity/activity"
import type { Clock } from "@taxa/shared/clock"
import type { ServerLogger } from "../telemetry/log.ts"
import {
  ChangeStatusRequestSchema,
  UndoTaskRequestSchema,
  CreateTaskRequestSchema,
  ListTasksQuerySchema,
  UpdateTaskRequestSchema
} from "@taxa/shared/tasks/task-requests"
import { TASKS_PATH, TaskSchema } from "@taxa/shared/tasks/task"
import { BIN_PATH, PurgedSchema } from "@taxa/shared/tasks/bin"
import type { Db } from "../database/database.ts"
import { onceFor } from "../http/idempotency.ts"
import { ifMatchVersion } from "../http/if-match.ts"
import { BEARER, IfMatchHeaderSchema, PROBLEMS, json, jsonBody, listOf } from "../http/openapi.ts"
import type { TaxaApp } from "../http/taxa-hono.ts"
import {
  changeTaskStatus,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  restoreTask,
  taskActivity,
  updateTask
} from "./task-service.ts"
import { undoTask } from "./task-undo.ts"
import { emptyBin, purgeTask } from "./task-purge.ts"

const TASK_PATH = `${TASKS_PATH}/{ref}`
const RefSchema = z.object({
  ref: z.string().openapi({ description: "The task: H-142, 142 (the prefix is optional) or its id", example: "H-142" })
})

const routes = {
  list: createRoute({
    method: "get",
    path: TASKS_PATH,
    summary: "Tasks you can see, most urgent first",
    security: BEARER,
    request: { query: ListTasksQuerySchema },
    responses: { 200: json(listOf(TaskSchema), "The matching tasks"), ...PROBLEMS }
  }),
  create: createRoute({
    method: "post",
    path: TASKS_PATH,
    summary: "Create a task",
    description: "Without a domain, it goes in your Inbox. Send an Idempotency-Key header to make retries safe.",
    security: BEARER,
    request: jsonBody(CreateTaskRequestSchema),
    responses: { 201: json(TaskSchema, "The new task"), ...PROBLEMS }
  }),
  get: createRoute({
    method: "get",
    path: TASK_PATH,
    summary: "One task",
    security: BEARER,
    request: { params: RefSchema },
    responses: { 200: json(TaskSchema, "The task, with its version in the ETag"), ...PROBLEMS }
  }),
  update: createRoute({
    method: "patch",
    path: TASK_PATH,
    summary: "Set and clear a task's fields",
    security: BEARER,
    request: { params: RefSchema, headers: IfMatchHeaderSchema, ...jsonBody(UpdateTaskRequestSchema) },
    responses: { 200: json(TaskSchema, "The task as it is now"), ...PROBLEMS }
  }),
  status: createRoute({
    method: "post",
    path: `${TASK_PATH}/status`,
    summary: "Move a task to a status: OPEN, IN_PROGRESS, WAITING, DONE or CANCELLED",
    security: BEARER,
    request: { params: RefSchema, headers: IfMatchHeaderSchema, ...jsonBody(ChangeStatusRequestSchema) },
    responses: { 200: json(TaskSchema, "The task as it is now"), ...PROBLEMS }
  }),
  delete: createRoute({
    method: "delete",
    path: TASK_PATH,
    summary: "Delete a task (it can be restored)",
    security: BEARER,
    request: { params: RefSchema, headers: IfMatchHeaderSchema },
    responses: { 200: json(TaskSchema, "The deleted task"), ...PROBLEMS }
  }),
  restore: createRoute({
    method: "post",
    path: `${TASK_PATH}/restore`,
    summary: "Restore a deleted task",
    security: BEARER,
    request: { params: RefSchema },
    responses: { 200: json(TaskSchema, "The restored task"), ...PROBLEMS }
  }),
  purge: createRoute({
    method: "post",
    path: `${TASK_PATH}/purge`,
    summary: "Delete a task in the bin for good",
    description:
      "What was written in it, and in its log, is wiped, and it can't be restored. A task left in the bin for 30 days goes this way by itself.",
    security: BEARER,
    request: { params: RefSchema },
    responses: { 200: json(PurgedSchema, "How many were deleted for good: 1"), ...PROBLEMS }
  }),
  emptyBin: createRoute({
    method: "post",
    path: `${BIN_PATH}/empty`,
    summary: "Delete every task in the bin for good",
    security: BEARER,
    responses: { 200: json(PurgedSchema, "How many were deleted for good"), ...PROBLEMS }
  }),
  undo: createRoute({
    method: "post",
    path: `${TASK_PATH}/undo`,
    summary: "Undo the change that brought a task to a version",
    description:
      "Whoever made it. A task added is deleted, a deleted one restored, and an edit or status change put back, unless what it changed has changed since (409). The undo is a change too: undo it to redo.",
    security: BEARER,
    request: { params: RefSchema, ...jsonBody(UndoTaskRequestSchema) },
    responses: { 200: json(TaskSchema, "The task as it is now"), ...PROBLEMS }
  }),
  activity: createRoute({
    method: "get",
    path: `${TASK_PATH}/activity`,
    summary: "Every change to a task, oldest first, with who made it",
    security: BEARER,
    request: { params: RefSchema },
    responses: { 200: json(listOf(ActivitySchema), "The task's changes"), ...PROBLEMS }
  })
}

export const taskRoutes = (app: TaxaApp, db: Db, log: ServerLogger, clock: Clock): void => {
  app.openapi(routes.list, async (context) =>
    context.json({ items: await listTasks(db, context.var.caller, context.req.valid("query"), clock.now()) }, 200)
  )
  app.openapi(routes.create, async (context) => {
    const { caller } = context.var
    const now = clock.now()
    const task = await onceFor(db, context, caller, now, () =>
      createTask(db, log, caller, context.req.valid("json"), now)
    )
    return context.json(task, 201, { etag: `"${task.version}"` })
  })
  app.openapi(routes.get, async (context) => {
    const task = await getTask(db, context.var.caller, context.req.valid("param").ref)
    return context.json(task, 200, { etag: `"${task.version}"` })
  })
  app.openapi(routes.update, async (context) => {
    const ifMatch = ifMatchVersion(context.req.valid("header")["if-match"])
    const { ref } = context.req.valid("param")
    const task = await updateTask(db, log, context.var.caller, ref, context.req.valid("json"), ifMatch, clock.now())
    return context.json(task, 200, { etag: `"${task.version}"` })
  })
  app.openapi(routes.status, async (context) => {
    const ifMatch = ifMatchVersion(context.req.valid("header")["if-match"])
    const { ref } = context.req.valid("param")
    const task = await changeTaskStatus(
      db,
      log,
      context.var.caller,
      ref,
      context.req.valid("json"),
      ifMatch,
      clock.now()
    )
    return context.json(task, 200, { etag: `"${task.version}"` })
  })
  app.openapi(routes.delete, async (context) => {
    const ifMatch = ifMatchVersion(context.req.valid("header")["if-match"])
    const task = await deleteTask(db, log, context.var.caller, context.req.valid("param").ref, ifMatch, clock.now())
    return context.json(task, 200)
  })
  app.openapi(routes.restore, async (context) =>
    context.json(await restoreTask(db, log, context.var.caller, context.req.valid("param").ref, clock.now()), 200)
  )
  app.openapi(routes.purge, async (context) => {
    await purgeTask(db, log, context.var.caller, context.req.valid("param").ref, clock.now())
    return context.json({ purged: 1 }, 200)
  })
  app.openapi(routes.emptyBin, async (context) =>
    context.json({ purged: await emptyBin(db, log, context.var.caller, clock.now()) }, 200)
  )
  app.openapi(routes.undo, async (context) => {
    const { ref } = context.req.valid("param")
    const task = await undoTask(db, log, context.var.caller, ref, context.req.valid("json").version, clock.now())
    return context.json(task, 200, { etag: `"${task.version}"` })
  })
  app.openapi(routes.activity, async (context) =>
    context.json({ items: await taskActivity(db, context.var.caller, context.req.valid("param").ref) }, 200)
  )
}
