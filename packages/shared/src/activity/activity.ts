import { z } from "zod"
import { ActorSchema } from "../identity/actor.ts"

export enum ActivityType {
  DOMAIN_CREATED = "DOMAIN_CREATED",
  TASK_CREATED = "TASK_CREATED",
  TASK_UPDATED = "TASK_UPDATED",
  TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED",
  TASK_DELETED = "TASK_DELETED",
  TASK_RESTORED = "TASK_RESTORED"
}

const FieldChangeSchema = z.object({ from: z.unknown().optional(), to: z.unknown().optional() })

export type FieldChange = z.infer<typeof FieldChangeSchema>

/** One change, as the activity log keeps it. */
export const ActivitySchema = z.object({
  /** Increases with every change: a client that has seen up to N asks for what came after. */
  sequence: z.number().int(),
  at: z.iso.datetime(),
  actor: ActorSchema,
  type: z.enum(ActivityType),
  /** What changed, field by field. */
  changes: z.record(z.string(), FieldChangeSchema)
})

export type Activity = z.infer<typeof ActivitySchema>
