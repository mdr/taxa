import type { LogFields } from "@taxa/shared/telemetry/log"
import type { Caller } from "../auth/caller.ts"

/** Who made a change, for its log line: the person, and the agent acting for them if any. */
export const callerFields = (caller: Caller): LogFields => ({ userId: caller.user.id, agentId: caller.agent?.id })
