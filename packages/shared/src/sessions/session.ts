import { z } from "zod"
import { VersionSchema } from "../domains/domain.ts"
import { SessionIdSchema, TaskIdSchema } from "../ids.ts"
import { TaskSchema } from "../tasks/task.ts"
import { flavoured, type Minutes, type Ms } from "../units.ts"

export const SESSIONS_PATH = "/api/sessions"
export const CURRENT_SESSION_PATH = `${SESSIONS_PATH}/current`

/** The longest a session, or the time planned for one task in it, can be. */
const MAX_SESSION_MINUTES: Minutes = 24 * 60

/** How a task in a session went, once you've moved on from it. */
export enum SessionOutcome {
  /** Finished, and ticked off. */
  DONE = "DONE",
  /** Worked on, then left for another time. */
  STOPPED = "STOPPED"
}

const PlannedMinutesSchema = flavoured<Minutes>(z.number().int().min(1).max(MAX_SESSION_MINUTES))

const SessionItemSchema = z.object({
  task: TaskSchema,
  /** The time planned for it in this session: not its estimate, which is for the whole task. */
  minutes: PlannedMinutesSchema,
  /** Time spent on it in this session, not counting the stretch under way while it's current. */
  spentMs: flavoured<Ms>(z.number().int().min(0)),
  outcome: z.enum(SessionOutcome).optional()
})

export type SessionItem = z.infer<typeof SessionItemSchema>

/**
 * A block of time someone has planned: the tasks to work through, in order,
 * with the time meant for each, and how it's going.
 */
export const SessionSchema = z.object({
  id: SessionIdSchema,
  startedAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  /** In the order planned. Tasks you can no longer see are left out. */
  items: z.array(SessionItemSchema),
  /** The task being worked on, and since when; none between tasks and once the session's over. */
  current: z.object({ taskId: TaskIdSchema, since: z.iso.datetime() }).optional(),
  note: z.string(),
  /** When it was ended; until then, it's your current session. */
  endedAt: z.iso.datetime().optional(),
  version: VersionSchema
})

export type Session = z.infer<typeof SessionSchema>

export const CurrentSessionSchema = z.object({ session: SessionSchema.optional() })
export type CurrentSession = z.infer<typeof CurrentSessionSchema>

const PlannedTaskSchema = z.object({ taskId: TaskIdSchema, minutes: PlannedMinutesSchema })
export type PlannedTask = z.infer<typeof PlannedTaskSchema>

const PlanSchema = z
  .array(PlannedTaskSchema)
  .max(100)
  .refine((items) => new Set(items.map(({ taskId }) => taskId)).size === items.length, "each task once")

export const CreateSessionRequestSchema = z.object({
  id: SessionIdSchema.optional(),
  /** When the time you have ends; the session starts now. */
  endsAt: z.iso.datetime(),
  items: PlanSchema,
  /** A task in the plan to start on at once. */
  start: TaskIdSchema.optional()
})

export type CreateSessionRequest = z.input<typeof CreateSessionRequestSchema>

/**
 * Changes to a session, applied in this order: finish the current task,
 * replan, start a task, end the session. Once a session has ended, only its
 * note can change.
 */
export const UpdateSessionRequestSchema = z.object({
  /** Moves on from the current task: DONE ticks it off, STOPPED leaves it open. */
  finish: z.enum(SessionOutcome).optional(),
  set: z
    .object({
      endsAt: z.iso.datetime().optional(),
      /** The whole plan, in order: time spent on tasks kept in it is kept. */
      items: PlanSchema.optional(),
      note: z.string().max(10_000).optional()
    })
    .optional(),
  /** Starts working on a task in the plan, putting it in progress. */
  start: TaskIdSchema.optional(),
  /** Ends the session, stopping the current task if there is one. */
  end: z.literal(true).optional()
})

export type UpdateSessionRequest = z.input<typeof UpdateSessionRequestSchema>
