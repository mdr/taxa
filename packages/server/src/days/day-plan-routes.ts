import { createRoute, z } from "@hono/zod-openapi"
import type { Clock } from "@taxa/shared/clock"
import { ProblemType } from "@taxa/shared/api/problem"
import { isIsoDate, type IsoDate } from "@taxa/shared/dates/plain-date"
import { DAY_PLANS_PATH, DayPlanSchema, SetDayPlanRequestSchema } from "@taxa/shared/days/day-plan"
import type { Db } from "../database/database.ts"
import { ProblemError } from "../http/problem-error.ts"
import { BEARER, PROBLEMS, json, jsonBody } from "../http/openapi.ts"
import type { TaxaApp } from "../http/taxa-hono.ts"
import { getDayPlan, setDayPlan } from "./day-plan-service.ts"

const DAY_PLAN_PATH = `${DAY_PLANS_PATH}/{date}`
const DateSchema = z.object({ date: z.string().openapi({ description: "The day, written YYYY-MM-DD" }) })

/** The day in the address, which must be a date. */
const dayOf = (date: string): IsoDate => {
  if (!isIsoDate(date)) throw new ProblemError(ProblemType.INVALID_REQUEST, `${date} isn't a date written YYYY-MM-DD.`)
  return date
}

const routes = {
  get: createRoute({
    method: "get",
    path: DAY_PLAN_PATH,
    summary: "The order you mean to do a day's tasks in",
    description: "The day's tasks are those scheduled for it; this only orders them. With no plan, it's empty.",
    security: BEARER,
    request: { params: DateSchema },
    responses: { 200: json(DayPlanSchema, "The plan"), ...PROBLEMS }
  }),
  set: createRoute({
    method: "put",
    path: DAY_PLAN_PATH,
    summary: "Put a day's tasks in order",
    description: "Replaces the order. Tasks you can't see are left out.",
    security: BEARER,
    request: { params: DateSchema, ...jsonBody(SetDayPlanRequestSchema) },
    responses: { 200: json(DayPlanSchema, "The plan as it is now"), ...PROBLEMS }
  })
}

export const dayPlanRoutes = (app: TaxaApp, db: Db, clock: Clock): void => {
  app.openapi(routes.get, async (context) =>
    context.json(await getDayPlan(db, context.var.caller, dayOf(context.req.valid("param").date)), 200)
  )
  app.openapi(routes.set, async (context) =>
    context.json(
      await setDayPlan(
        db,
        context.var.caller,
        dayOf(context.req.valid("param").date),
        context.req.valid("json").taskIds,
        clock.now()
      ),
      200
    )
  )
}
