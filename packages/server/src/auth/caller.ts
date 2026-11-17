import type { TimeZone } from "@taxa/shared/dates/plain-date"
import type { AgentId, DomainId, UserId } from "@taxa/shared/ids"
export interface CallerUser {
  id: UserId
  name: string
  timeZone: TimeZone
  defaultDomainId: DomainId | undefined
}

/** Who is making a request: a person, or an agent acting for them. */
export interface Caller {
  user: CallerUser
  agent: { id: AgentId; name: string } | undefined
  agentContext: string | undefined
}
