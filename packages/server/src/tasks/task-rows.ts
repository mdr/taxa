import type { DomainPrefix } from "@taxa/shared/domains/domain"
import type { Actor } from "@taxa/shared/identity/actor"
import { definedFields } from "@taxa/shared/objects"
import { formatTaskRef } from "@taxa/shared/tasks/task-ref"
import type { Task } from "@taxa/shared/tasks/task"
import type { ActorIds } from "../activity/actor-names.ts"
import type { tasks } from "../database/schema.ts"
import type { TaskState } from "./task-state.ts"

export type TaskRow = typeof tasks.$inferSelect
export type TaskValues = Omit<typeof tasks.$inferInsert, "id" | "number" | "createdAt">

const instantOf = (date: Date | null): number | undefined => date?.getTime()
const dateOf = (instant: number | undefined): Date | null => (instant === undefined ? null : new Date(instant))
const isoOf = (date: Date | null): string | undefined => date?.toISOString()

export enum Deletion {
  DELETE = "DELETE",
  RESTORE = "RESTORE"
}

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
  domainId: row.domainId,
  title: row.title,
  notes: row.notes,
  status: row.status,
  priority: row.priority,
  inbox: row.inbox,
  due: row.due ?? undefined,
  scheduled: row.scheduled ?? undefined,
  scheduledTime: row.scheduledTime ?? undefined,
  start: row.start ?? undefined,
  estimateMinutes: row.estimateMinutes ?? undefined,
  energy: row.energy ?? undefined,
  inProgressBy: inProgressIdsOf(row),
  waitingOn: row.waitingOn ?? undefined,
  followUp: row.followUp ?? undefined,
  completedAt: instantOf(row.completedAt),
  cancelledAt: instantOf(row.cancelledAt),
  cancelledReason: row.cancelledReason ?? undefined
})

export const valuesOf = (state: TaskState): Omit<TaskValues, "updatedAt" | "version" | "deletedAt"> => ({
  domainId: state.domainId,
  title: state.title,
  notes: state.notes,
  status: state.status,
  priority: state.priority,
  inbox: state.inbox,
  due: state.due ?? null,
  scheduled: state.scheduled ?? null,
  scheduledTime: state.scheduledTime ?? null,
  start: state.start ?? null,
  estimateMinutes: state.estimateMinutes ?? null,
  energy: state.energy ?? null,
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
export const taskOf = (row: TaskRow, prefix: DomainPrefix, actorOf: (ids: ActorIds) => Actor): Task => {
  const inProgressBy = inProgressIdsOf(row)
  const task: Task = {
    id: row.id,
    ref: formatTaskRef(prefix, row.number),
    number: row.number,
    domainId: row.domainId,
    title: row.title,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    inbox: row.inbox,
    due: row.due ?? undefined,
    scheduled: row.scheduled ?? undefined,
    scheduledTime: row.scheduledTime ?? undefined,
    start: row.start ?? undefined,
    estimateMinutes: row.estimateMinutes ?? undefined,
    energy: row.energy ?? undefined,
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
