import type { DomainPrefix } from "@taxa/shared/domains/domain"
import type { Actor } from "@taxa/shared/identity/actor"
import { definedFields } from "@taxa/shared/objects"
import { formatTaskRef } from "@taxa/shared/tasks/task-ref"
import type { Task } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import type { ActorIds } from "../activity/actor-names.ts"
import type { tasks } from "../database/schema.ts"
import type { TaskState } from "./task-state.ts"
import type { FoundTask } from "./task-store.ts"

export type TaskRow = typeof tasks.$inferSelect
export type TaskValues = Omit<typeof tasks.$inferInsert, "id" | "number" | "createdAt">

const instantOf = (date: Date | null): number | undefined => date?.getTime()
const dateOf = (instant: number | undefined): Date | null => (instant === undefined ? null : new Date(instant))
const isoOf = (date: Date | null): string | undefined => date?.toISOString()

export enum Deletion {
  DELETE = "DELETE",
  RESTORE = "RESTORE"
}

/** When a task was put in its horizon, as stored: now, if it has one; none, if not. */
export const horizonSetAtFor = (state: TaskState, now: number): Date | null => (state.horizon ? new Date(now) : null)

export const deletedAtFor = (deletion: Deletion, at: number): Date | null =>
  deletion === Deletion.DELETE ? new Date(at) : null

export const inProgressIdsOf = (row: TaskRow): ActorIds | undefined =>
  row.inProgressUserId
    ? {
        userId: row.inProgressUserId,
        agentId: row.inProgressAgentId ?? undefined,
        agentContext: row.inProgressAgentContext ?? undefined
      }
    : undefined

export const stateOf = (row: TaskRow): TaskState => ({
  domainId: row.domainId ?? undefined,
  inboxUserId: row.inboxUserId ?? undefined,
  title: row.title,
  notes: row.notes,
  status: row.status,
  priority: row.priority,
  due: row.due ?? undefined,
  scheduled: row.scheduled ?? undefined,
  scheduledTime: row.scheduledTime ?? undefined,
  start: row.start ?? undefined,
  estimateMinutes: row.estimateMinutes ?? undefined,
  energy: row.energy ?? undefined,
  horizon: row.horizon ?? undefined,
  tags: row.tags,
  repeat: row.repeat ?? undefined,
  followsOnId: row.followsOnId ?? undefined,
  inProgressBy: inProgressIdsOf(row),
  waitingOn: row.waitingOn ?? undefined,
  followUp: row.followUp ?? undefined,
  completedAt: instantOf(row.completedAt),
  cancelledAt: instantOf(row.cancelledAt),
  cancelledReason: row.cancelledReason ?? undefined
})

export const valuesOf = (state: TaskState): Omit<TaskValues, "updatedAt" | "version" | "deletedAt"> => ({
  domainId: state.domainId ?? null,
  inboxUserId: state.inboxUserId ?? null,
  title: state.title,
  notes: state.notes,
  status: state.status,
  priority: state.priority,
  due: state.due ?? null,
  scheduled: state.scheduled ?? null,
  scheduledTime: state.scheduledTime ?? null,
  start: state.start ?? null,
  estimateMinutes: state.estimateMinutes ?? null,
  energy: state.energy ?? null,
  horizon: state.horizon ?? null,
  tags: [...state.tags],
  repeat: state.repeat ?? null,
  followsOnId: state.followsOnId ?? null,
  inProgressUserId: state.inProgressBy?.userId ?? null,
  inProgressAgentId: state.inProgressBy?.agentId ?? null,
  inProgressAgentContext: state.inProgressBy?.agentContext ?? null,
  waitingOn: state.waitingOn ?? null,
  followUp: state.followUp ?? null,
  completedAt: dateOf(state.completedAt),
  cancelledAt: dateOf(state.cancelledAt),
  cancelledReason: state.cancelledReason ?? null
})

/** A task as the API shows it. */
export const taskOf = (row: TaskRow, prefix: DomainPrefix | undefined, actorOf: (ids: ActorIds) => Actor): Task => {
  const inProgressBy = inProgressIdsOf(row)
  const task: Task = {
    id: row.id,
    ref: formatTaskRef(prefix, row.number),
    number: row.number,
    domainId: row.domainId ?? undefined,
    title: row.title,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    inbox: row.inboxUserId !== null,
    due: row.due ?? undefined,
    scheduled: row.scheduled ?? undefined,
    scheduledTime: row.scheduledTime ?? undefined,
    start: row.start ?? undefined,
    estimateMinutes: row.estimateMinutes ?? undefined,
    energy: row.energy ?? undefined,
    horizon: row.horizon ?? undefined,
    horizonSetAt: isoOf(row.horizonSetAt),
    tags: row.tags,
    repeat: row.repeat ?? undefined,
    followsOnId: row.followsOnId ?? undefined,
    inProgressBy: inProgressBy && actorOf(inProgressBy),
    waitingOn: row.waitingOn ?? undefined,
    followUp: row.followUp ?? undefined,
    completedAt: isoOf(row.completedAt),
    cancelledAt: isoOf(row.cancelledAt),
    cancelledReason: row.cancelledReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: isoOf(row.deletedAt),
    version: row.version
  }
  // Absent fields are left out of the JSON, not sent as undefined.
  return definedFields(task) as Task
}

/** A task row as selected with its domain's prefix, which is empty while it's in the Inbox. */
export const foundOf = ({ row, prefix }: { row: TaskRow; prefix: DomainPrefix | null }): FoundTask => ({
  row,
  prefix: prefix ?? undefined
})

/** A task deleted for good: what was written in it, gone. */
export const purgedValues = (now: Instant): Partial<TaskValues> => ({
  title: "",
  notes: "",
  tags: [],
  repeat: null,
  waitingOn: null,
  cancelledReason: null,
  inProgressAgentContext: null,
  purgedAt: new Date(now)
})

/** Its log, with nothing left of what each change wrote. */
export const PURGED_ACTIVITY = { changes: {}, agentContext: null }
