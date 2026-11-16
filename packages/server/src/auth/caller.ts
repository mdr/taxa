export interface CallerUser {
  id: string
  name: string
  timeZone: string
  defaultDomainId: string | undefined
}

/** Who is making a request: a person, or an agent acting for them. */
export interface Caller {
  user: CallerUser
  agent: { id: string; name: string } | undefined
  agentContext: string | undefined
}
