import { createRoute } from "@hono/zod-openapi"
import type { Clock } from "@taxa/shared/clock"
import type { ServerLogger } from "../telemetry/log.ts"
import { z } from "@hono/zod-openapi"
import { CreateDomainRequestSchema, DOMAIN_PATH, DOMAINS_PATH, DomainSchema } from "@taxa/shared/domains/domain"
import type { Db } from "../database/database.ts"
import { onceFor } from "../http/idempotency.ts"
import { BEARER, PROBLEMS, json, jsonBody, listOf } from "../http/openapi.ts"
import type { TaxaApp } from "../http/taxa-hono.ts"
import { createDomain, deleteDomain, domainsOf } from "./domain-store.ts"

const listDomainsRoute = createRoute({
  method: "get",
  path: DOMAINS_PATH,
  summary: "The domains you belong to",
  security: BEARER,
  responses: { 200: json(listOf(DomainSchema), "Your domains, oldest first"), ...PROBLEMS }
})

const createDomainRoute = createRoute({
  method: "post",
  path: DOMAINS_PATH,
  summary: "Create a domain, with you as its member",
  security: BEARER,
  request: jsonBody(CreateDomainRequestSchema),
  responses: { 201: json(DomainSchema, "The new domain"), ...PROBLEMS }
})

const deleteDomainRoute = createRoute({
  method: "delete",
  path: DOMAIN_PATH,
  summary: "Delete a domain, once it has no tasks, even in the Bin",
  security: BEARER,
  request: {
    params: z.object({
      domain: z.string().openapi({ description: "Its prefix, in any case, or its id", example: "H" })
    })
  },
  responses: { 200: json(DomainSchema, "The domain deleted"), ...PROBLEMS }
})

export const domainRoutes = (app: TaxaApp, db: Db, log: ServerLogger, clock: Clock): void => {
  app.openapi(listDomainsRoute, async (context) =>
    context.json({ items: await domainsOf(db, context.var.caller.user.id) }, 200)
  )
  app.openapi(deleteDomainRoute, async (context) =>
    context.json(await deleteDomain(db, log, context.var.caller, context.req.valid("param").domain, clock.now()), 200)
  )
  app.openapi(createDomainRoute, async (context) => {
    const { caller } = context.var
    const now = clock.now()
    const domain = await onceFor(db, context, caller, now, () =>
      createDomain(db, log, caller, context.req.valid("json"), now)
    )
    return context.json(domain, 201)
  })
}
