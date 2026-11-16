import { z } from "zod"

export const AGENTS_PATH = "/api/agents"
export const KEYS_PATH = "/api/keys"

export const AgentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime()
})

export type Agent = z.infer<typeof AgentSchema>

export const CreateAgentRequestSchema = z.object({ name: z.string().trim().min(1).max(100) })

export const ApiKeySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** The start of the key, to tell keys apart. */
  prefix: z.string(),
  agentId: z.uuid().optional(),
  createdAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().optional()
})

export type ApiKey = z.infer<typeof ApiKeySchema>

export const CreateKeyRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** The agent the key acts as; without one, the key acts as you. */
  agentId: z.uuid().optional()
})

/** A new key, with its secret: shown this once and never again. */
export const CreatedKeySchema = ApiKeySchema.extend({ secret: z.string() })

export type CreatedKey = z.infer<typeof CreatedKeySchema>
