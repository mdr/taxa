import { z } from "zod"
import { IsoDateSchema, IsoTimeSchema } from "../dates/plain-date.ts"
import { ActorSchema } from "../identity/actor.ts"
import { VersionSchema } from "../domains/domain.ts"
import { DomainIdSchema, TaskIdSchema } from "../ids.ts"
import { flavoured, type Minutes, type TaskNumber } from "../units.ts"
import { TaskRefSchema } from "./task-ref.ts"

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

/** How far off a task without a date is: next up, or one day perhaps. Neither means any time. */
export enum Horizon {
  SOON = "SOON",
  SOMEDAY = "SOMEDAY"
}

/** How many days a task waits before it asks to be followed up, unless told otherwise. */
export const DEFAULT_FOLLOW_UP_DAYS = 7

export const TaskSchema = z.object({
  id: TaskIdSchema,
  /** How people refer to it: `H-142`. */
  ref: TaskRefSchema,
  number: flavoured<TaskNumber>(z.number().int()),
  /** Absent while it's in the Inbox. */
  domainId: DomainIdSchema.optional(),
  title: z.string(),
  /** Markdown. */
  notes: z.string(),
  status: z.enum(TaskStatus),
  priority: z.enum(Priority),
  /** In its creator's Inbox, not yet filed in a domain: seen only by them. */
  inbox: z.boolean(),
  due: IsoDateSchema.optional(),
  scheduled: IsoDateSchema.optional(),
  /** A floating time on the scheduled day. */
  scheduledTime: IsoTimeSchema.optional(),
  /** Hidden from lists until this date. */
  start: IsoDateSchema.optional(),
  estimateMinutes: flavoured<Minutes>(z.number().int()).optional(),
  energy: z.enum(Energy).optional(),
  /** Soon or someday; a scheduled date says when instead. Someday tasks stay out of lists until looked for. */
  horizon: z.enum(Horizon).optional(),
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
  version: VersionSchema
})

export type Task = z.infer<typeof TaskSchema>
