import { createRoute, z } from "@hono/zod-openapi"
import type { Clock } from "@taxa/shared/clock"
import {
  AGENTS_PATH,
  AgentSchema,
  ApiKeySchema,
  CreateAgentRequestSchema,
  CreateKeyRequestSchema,
  CreatedKeySchema,
  KEYS_PATH
} from "@taxa/shared/identity/agent"
import { ME_PATH, MeSchema } from "@taxa/shared/identity/actor"
import type { Db } from "../database/database.ts"
import { BEARER, PROBLEMS, json, jsonBody, listOf } from "../http/openapi.ts"
import type { TaxaApp } from "../http/taxa-hono.ts"
import { agentsOf, createAgent, createKey, keysOf, revokeKey } from "./agent-store.ts"

const routes = {
  me: createRoute({
    method: "get",
    path: ME_PATH,
    summary: "Who you are: a person, or an agent acting for one",
    security: BEARER,
    responses: { 200: json(MeSchema, "You"), ...PROBLEMS }
  }),
  agents: createRoute({
    method: "get",
    path: AGENTS_PATH,
    summary: "Your agents",
    security: BEARER,
    responses: { 200: json(listOf(AgentSchema), "Your agents"), ...PROBLEMS }
  }),
  createAgent: createRoute({
    method: "post",
    path: AGENTS_PATH,
    summary: "Create an agent: an identity, such as Claude Code, that acts for you with its own keys",
    security: BEARER,
    request: jsonBody(CreateAgentRequestSchema),
    responses: { 201: json(AgentSchema, "The new agent"), ...PROBLEMS }
  }),
  keys: createRoute({
    method: "get",
    path: KEYS_PATH,
    summary: "Your API keys and your agents', without their secrets",
    security: BEARER,
    responses: { 200: json(listOf(ApiKeySchema), "Your keys"), ...PROBLEMS }
  }),
  createKey: createRoute({
    method: "post",
    path: KEYS_PATH,
    summary:
      "Create an API key, for you or one of your agents. The answer holds its secret, which is never shown again.",
    security: BEARER,
    request: jsonBody(CreateKeyRequestSchema),
    responses: { 201: json(CreatedKeySchema, "The new key, with its secret"), ...PROBLEMS }
  }),
  revokeKey: createRoute({
    method: "delete",
    path: `${KEYS_PATH}/{id}`,
    summary: "Revoke an API key",
    security: BEARER,
    request: { params: z.object({ id: z.uuid() }) },
    responses: { 200: json(ApiKeySchema, "The revoked key"), ...PROBLEMS }
  })
}

export const agentRoutes = (app: TaxaApp, db: Db, clock: Clock): void => {
  app.openapi(routes.me, (context) => {
    const { user, agent } = context.var.caller
    return context.json(
      {
        user: {
          id: user.id,
          name: user.name,
          timeZone: user.timeZone,
          ...(user.defaultDomainId && { defaultDomainId: user.defaultDomainId })
        },
        ...(agent && { agent })
      },
      200
    )
  })
  app.openapi(routes.agents, async (context) => context.json({ items: await agentsOf(db, context.var.caller) }, 200))
  app.openapi(routes.createAgent, async (context) =>
    context.json(await createAgent(db, context.var.caller, context.req.valid("json").name, clock.now()), 201)
  )
  app.openapi(routes.keys, async (context) => context.json({ items: await keysOf(db, context.var.caller) }, 200))
  app.openapi(routes.createKey, async (context) =>
    context.json(await createKey(db, context.var.caller, context.req.valid("json"), clock.now()), 201)
  )
  app.openapi(routes.revokeKey, async (context) =>
    context.json(await revokeKey(db, context.var.caller, context.req.valid("param").id, clock.now()), 200)
  )
}
