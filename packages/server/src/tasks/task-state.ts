import type { Minutes } from "@taxa/shared/units"
import type { DomainId } from "@taxa/shared/ids"
import type { FieldChange } from "@taxa/shared/activity/activity"
import { addDays, type IsoDate, type IsoTime } from "@taxa/shared/dates/plain-date"
import type { ClearableField, ChangeStatusRequest } from "@taxa/shared/tasks/task-requests"
import { DEFAULT_FOLLOW_UP_DAYS, TaskStatus, type Energy, type Priority } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import { definedFields } from "@taxa/shared/objects"
import type { ActorIds } from "../activity/actor-names.ts"

/** What a task says, apart from its identity and bookkeeping: what edits change. */
export interface TaskState {
  domainId: DomainId
  title: string
  notes: string
  status: TaskStatus
  priority: Priority
  inbox: boolean
  due: IsoDate | undefined
  scheduled: IsoDate | undefined
  scheduledTime: IsoTime | undefined
  start: IsoDate | undefined
  estimateMinutes: Minutes | undefined
  energy: Energy | undefined
  inProgressBy: ActorIds | undefined
  waitingOn: string | undefined
  followUp: IsoDate | undefined
  completedAt: Instant | undefined
  cancelledAt: Instant | undefined
  cancelledReason: string | undefined
}

export interface Edit {
  set: Partial<
    Omit<
      TaskState,
      "status" | "inProgressBy" | "waitingOn" | "followUp" | "completedAt" | "cancelledAt" | "cancelledReason"
    >
  >
  clear: readonly ClearableField[]
}

export interface Outcome {
  state: TaskState
  /** Only the fields that changed. */
  changes: Record<string, FieldChange>
}

const INSTANT_FIELDS: ReadonlySet<keyof TaskState> = new Set(["completedAt", "cancelledAt"])

/** A field's value as the activity log keeps it: instants as ISO strings, which people and agents can read. */
const logged = (key: keyof TaskState, value: unknown): unknown =>
  INSTANT_FIELDS.has(key) && typeof value === "number" ? new Date(value).toISOString() : value

const changesBetween = (before: TaskState, after: TaskState): Record<string, FieldChange> => {
  const changes: Record<string, FieldChange> = {}
  for (const key of Object.keys(after) as (keyof TaskState)[]) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue
    changes[key] = {
      ...(before[key] !== undefined && { from: logged(key, before[key]) }),
      ...(after[key] !== undefined && { to: logged(key, after[key]) })
    }
  }
  return changes
}

/**
 * Sets and clears fields. Filing a task in a domain takes it out of the
 * Inbox, unless the edit says where it belongs itself.
 */
export const editTask = (before: TaskState, { set, clear }: Edit): Outcome => {
  const after: TaskState = { ...before }
  Object.assign(after, definedFields(set))
  for (const field of clear) after[field] = undefined
  if (set.domainId !== undefined && set.domainId !== before.domainId && set.inbox === undefined) after.inbox = false
  return { state: after, changes: changesBetween(before, after) }
}

const leavingStatus = (state: TaskState): TaskState => ({
  ...state,
  inProgressBy: undefined,
  waitingOn: undefined,
  followUp: undefined,
  completedAt: undefined,
  cancelledAt: undefined,
  cancelledReason: undefined
})

export interface StatusContext {
  actor: ActorIds
  today: IsoDate
  now: Instant
}

/** Moves a task to a status, recording what that status needs and forgetting what the old one held. */
export const changeStatus = (
  before: TaskState,
  { status, waitingOn, followUp, reason }: ChangeStatusRequest,
  { actor, today, now }: StatusContext
): Outcome => {
  const cleared = { ...leavingStatus(before), status }
  const after: TaskState = (() => {
    switch (status) {
      case TaskStatus.OPEN:
        return cleared
      case TaskStatus.IN_PROGRESS:
        return { ...cleared, inProgressBy: actor }
      case TaskStatus.WAITING:
        return {
          ...cleared,
          waitingOn: waitingOn || undefined,
          followUp: followUp ?? addDays(today, DEFAULT_FOLLOW_UP_DAYS)
        }
      case TaskStatus.DONE:
        return { ...cleared, completedAt: before.status === TaskStatus.DONE ? before.completedAt : now }
      case TaskStatus.CANCELLED:
        return {
          ...cleared,
          cancelledAt: before.status === TaskStatus.CANCELLED ? before.cancelledAt : now,
          cancelledReason: reason || undefined
        }
    }
  })()
  return { state: after, changes: changesBetween(before, after) }
}

/** Every field a new task starts with, for the activity log. */
export const changesFromNothing = (state: TaskState): Record<string, FieldChange> =>
  Object.fromEntries(
    Object.entries(state)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, { to: logged(key as keyof TaskState, value) }])
  )
