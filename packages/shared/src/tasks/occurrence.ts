import { z } from "zod"
import { IsoDateSchema } from "../dates/plain-date.ts"
import { ActorSchema } from "../identity/actor.ts"
import { OccurrenceIdSchema, TaskIdSchema } from "../ids.ts"
import { OccurrenceOutcome } from "./repeat.ts"

/** One time a repeating task came round, and what happened to it. */
export const OccurrenceSchema = z.object({
  id: OccurrenceIdSchema,
  taskId: TaskIdSchema,
  /** The date it was for: the task's scheduled date then. */
  date: IsoDateSchema,
  outcome: z.enum(OccurrenceOutcome),
  /** The day it was actually done or skipped, in the time zone of whoever did it. */
  on: IsoDateSchema,
  at: z.iso.datetime(),
  by: ActorSchema
})

export type Occurrence = z.infer<typeof OccurrenceSchema>
