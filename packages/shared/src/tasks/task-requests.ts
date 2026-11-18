import { z } from "zod"
import { IsoDateSchema, IsoTimeSchema } from "../dates/plain-date.ts"
import { Energy, Priority, TaskStatus } from "./task.ts"
import { TaskIdSchema } from "../ids.ts"
import { flavoured, type Minutes } from "../units.ts"

const TitleSchema = z.string().trim().min(1).max(500)

/** The fields a task's owner sets directly. */
const EditableFieldsSchema = z.object({
  title: TitleSchema,
  notes: z.string().max(100_000),
  priority: z.enum(Priority),
  /** Back to your Inbox, out of its domain. */
  inbox: z.literal(true),
  due: IsoDateSchema,
  scheduled: IsoDateSchema,
  scheduledTime: IsoTimeSchema,
  start: IsoDateSchema,
  estimateMinutes: flavoured<Minutes>(z.number().int().min(1).max(100_000)),
  energy: z.enum(Energy),
  /** File it in this domain, by prefix or id. */
  domain: z.string()
})

/** Fields that can be emptied. */
export enum ClearableField {
  DUE = "due",
  SCHEDULED = "scheduled",
  SCHEDULED_TIME = "scheduledTime",
  START = "start",
  ESTIMATE_MINUTES = "estimateMinutes",
  ENERGY = "energy"
}

/** Without a domain, it goes in your Inbox. */
export const CreateTaskRequestSchema = EditableFieldsSchema.omit({ inbox: true }).partial().extend({
  /** Chosen by the client (a UUIDv7), so a task made offline is real at once. */
  id: TaskIdSchema.optional(),
  title: TitleSchema
})

export type CreateTaskRequest = z.input<typeof CreateTaskRequestSchema>

/** Sets some fields and empties others; fields it doesn't mention stay as they are. */
export const UpdateTaskRequestSchema = z.object({
  set: EditableFieldsSchema.partial().default({}),
  clear: z.array(z.enum(ClearableField)).default([])
})

export type UpdateTaskRequest = z.input<typeof UpdateTaskRequestSchema>

export const ChangeStatusRequestSchema = z.object({
  status: z.enum(TaskStatus),
  /** For WAITING. */
  waitingOn: z.string().trim().max(500).optional(),
  /** For WAITING; a week from today by default. */
  followUp: IsoDateSchema.optional(),
  /** For CANCELLED. */
  reason: z.string().trim().max(500).optional()
})

export type ChangeStatusRequest = z.input<typeof ChangeStatusRequestSchema>

export const ListTasksQuerySchema = z.object({
  /** A domain's prefix or id. */
  domain: z.string().optional(),
  /** Comma-separated; the active ones (OPEN, IN_PROGRESS, WAITING) by default. */
  status: z.string().optional(),
  /** true for your Inbox only, false for tasks filed in domains only. */
  inbox: z.enum(["true", "false"]).optional(),
  /** true to include tasks whose start date is still to come, which are hidden otherwise. */
  includeNotStarted: z.enum(["true", "false"]).optional(),
  /** Words to find in a task's title or notes: each must be in one or the other. Best matches first. */
  search: z.string().max(200).optional()
})

export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>
