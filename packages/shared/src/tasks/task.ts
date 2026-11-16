import { z } from "zod"
import { IsoDateSchema, IsoTimeSchema } from "../dates/plain-date.ts"
import { ActorSchema } from "../identity/actor.ts"

export const TASKS_PATH = "/api/tasks"

export enum TaskStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  WAITING = "WAITING",
  DONE = "DONE",
  CANCELLED = "CANCELLED"
}

/** Statuses of tasks still to be done: what lists show unless asked for others. */
export const ACTIVE_STATUSES: readonly TaskStatus[] = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.WAITING]

export enum Priority {
  URGENT = "URGENT",
  HIGH = "HIGH",
  NORMAL = "NORMAL",
  LOW = "LOW"
}

export enum Energy {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH"
}

/** How many days a task waits before it asks to be followed up, unless told otherwise. */
export const DEFAULT_FOLLOW_UP_DAYS = 7

export const TaskSchema = z.object({
  id: z.uuid(),
  /** How people refer to it: `H-142`. */
  ref: z.string(),
  number: z.number().int(),
  domainId: z.uuid(),
  title: z.string(),
  /** Markdown. */
  notes: z.string(),
  status: z.enum(TaskStatus),
  priority: z.enum(Priority),
  /** Not yet organised. */
  inbox: z.boolean(),
  due: IsoDateSchema.optional(),
  scheduled: IsoDateSchema.optional(),
  /** A floating time on the scheduled day. */
  scheduledTime: IsoTimeSchema.optional(),
  /** Hidden from lists until this date. */
  start: IsoDateSchema.optional(),
  estimateMinutes: z.number().int().optional(),
  energy: z.enum(Energy).optional(),
  /** While IN_PROGRESS: who is working on it. */
  inProgressBy: ActorSchema.optional(),
  /** While WAITING: what on, and when to follow it up. */
  waitingOn: z.string().optional(),
  followUp: IsoDateSchema.optional(),
  completedAt: z.iso.datetime().optional(),
  cancelledAt: z.iso.datetime().optional(),
  cancelledReason: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().optional(),
  /** Goes up by one with each change; send it back as If-Match to change only what you've seen. */
  version: z.number().int()
})

export type Task = z.infer<typeof TaskSchema>
