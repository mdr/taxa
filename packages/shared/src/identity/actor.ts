import { z } from "zod"

const NamedSchema = z.object({ id: z.uuid(), name: z.string() })

/** Who did something: a person, or an agent acting for them. */
export const ActorSchema = z.object({
  user: NamedSchema,
  agent: NamedSchema.optional(),
  /** What the agent said it was doing, unverified: a repo, a session. */
  agentContext: z.string().optional()
})

export type Actor = z.infer<typeof ActorSchema>

export const ME_PATH = "/api/me"

export const MeSchema = z.object({
  user: NamedSchema.extend({ timeZone: z.string(), defaultDomainId: z.uuid().optional() }),
  agent: NamedSchema.optional()
})

export type Me = z.infer<typeof MeSchema>

export const AGENT_CONTEXT_HEADER = "X-Taxa-Agent-Context"
