import type { TimeZone } from "@taxa/shared/dates/plain-date"
import type { AgentId, UserId } from "@taxa/shared/ids"
export interface CallerUser {
  id: UserId
  name: string
  timeZone: TimeZone
}

/** Who is making a request: a person, or an agent acting for them. */
export interface Caller {
  user: CallerUser
  agent: { id: AgentId; name: string } | undefined
  agentContext: string | undefined
}
