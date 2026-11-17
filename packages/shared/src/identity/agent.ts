import { z } from "zod"
import { AgentIdSchema, ApiKeyIdSchema } from "../ids.ts"

export const AGENTS_PATH = "/api/agents"
export const KEYS_PATH = "/api/keys"

export const AgentSchema = z.object({
  id: AgentIdSchema,
  name: z.string(),
  createdAt: z.iso.datetime()
})

export type Agent = z.infer<typeof AgentSchema>

export const CreateAgentRequestSchema = z.object({ name: z.string().trim().min(1).max(100) })

/** An API key's secret, which callers send as a bearer token. */
export const ApiKeySecretSchema = z.string().startsWith("taxa_").brand<"ApiKeySecret">()
export type ApiKeySecret = z.infer<typeof ApiKeySecretSchema>

export const ApiKeySchema = z.object({
  id: ApiKeyIdSchema,
  name: z.string(),
  /** The start of the key, to tell keys apart. */
  prefix: z.string(),
  agentId: AgentIdSchema.optional(),
  createdAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().optional()
})

export type ApiKey = z.infer<typeof ApiKeySchema>

export const CreateKeyRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** The agent the key acts as; without one, the key acts as you. */
  agentId: AgentIdSchema.optional()
})

/** A new key, with its secret: shown this once and never again. */
export const CreatedKeySchema = ApiKeySchema.extend({ secret: ApiKeySecretSchema })

export type CreatedKey = z.infer<typeof CreatedKeySchema>
