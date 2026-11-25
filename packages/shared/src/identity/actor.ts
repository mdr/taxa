import { z } from "zod"
import { TimeZoneSchema } from "../dates/plain-date.ts"
import { AgentIdSchema, UserIdSchema } from "../ids.ts"

const UserSchema = z.object({ id: UserIdSchema, name: z.string() })
const AgentNameSchema = z.object({ id: AgentIdSchema, name: z.string() })

/** Who did something: a person, or an agent acting for them. */
export const ActorSchema = z.object({
  user: UserSchema,
  agent: AgentNameSchema.optional(),
  /** What the agent said it was doing, unverified: a repo, a session. */
  agentContext: z.string().optional()
})

export type Actor = z.infer<typeof ActorSchema>

export const ME_PATH = "/api/me"

export const MeSchema = z.object({
  user: UserSchema.extend({ timeZone: TimeZoneSchema }),
  agent: AgentNameSchema.optional()
})

export type Me = z.infer<typeof MeSchema>

export const AGENT_CONTEXT_HEADER = "X-Taxa-Agent-Context"

/** The time zone a person's browser or CLI is in, which keeps theirs up to date: an agent's is ignored. */
export const TIME_ZONE_HEADER = "X-Taxa-Time-Zone"
