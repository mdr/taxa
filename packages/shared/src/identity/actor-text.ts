import type { Actor } from "./actor.ts"

/** `Matt`, or `Claude Code for Matt (mdr/taxa)`. */
export const actorText = ({ user, agent, agentContext }: Actor): string => {
  if (!agent) return user.name
  return `${agent.name} for ${user.name}${agentContext ? ` (${agentContext})` : ""}`
}
