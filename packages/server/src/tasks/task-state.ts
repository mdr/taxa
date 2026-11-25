import type { Minutes } from "@taxa/shared/units"
import type { DomainId, TaskId, UserId } from "@taxa/shared/ids"
import type { FieldChange } from "@taxa/shared/activity/activity"
import { addDays, daysBetween, type IsoDate, type IsoTime } from "@taxa/shared/dates/plain-date"
import type { ClearableField, ChangeStatusRequest } from "@taxa/shared/tasks/task-requests"
import { DEFAULT_FOLLOW_UP_DAYS, TaskStatus, type Energy, type Horizon, type Priority } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import type { Repeat } from "@taxa/shared/tasks/repeat"
import type { StoredChecklistItem } from "@taxa/shared/tasks/checklist"
import { definedFields } from "@taxa/shared/objects"
import type { ActorIds } from "../activity/actor-names.ts"

/** What a task says, apart from its identity and bookkeeping: what edits change. */
export interface TaskState {
  /** Exactly one of these: filed in a domain, or in someone's Inbox. */
  domainId: DomainId | undefined
  inboxUserId: UserId | undefined
  title: string
  notes: string
  status: TaskStatus
  priority: Priority
  due: IsoDate | undefined
  scheduled: IsoDate | undefined
  scheduledTime: IsoTime | undefined
  start: IsoDate | undefined
  estimateMinutes: Minutes | undefined
  energy: Energy | undefined
  horizon: Horizon | undefined
  tags: readonly string[]
  checklist: readonly StoredChecklistItem[]
  repeat: Repeat | undefined
  followsOnId: TaskId | undefined
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
      | "status"
      | "inProgressBy"
      | "waitingOn"
      | "followUp"
      | "completedAt"
      | "cancelledAt"
      | "cancelledReason"
      | "checklist"
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

/** A logged value as the field holds it again. */
const unlogged = (key: keyof TaskState, value: unknown): unknown =>
  INSTANT_FIELDS.has(key) && typeof value === "string" ? Date.parse(value) : value

/** Whether taking back a change could, or which of its fields have changed since. */
export enum RevertType {
  REVERTED = "REVERTED",
  CHANGED_SINCE = "CHANGED_SINCE"
}

export type Reverted =
  | { type: RevertType.REVERTED; outcome: Outcome }
  | { type: RevertType.CHANGED_SINCE; fields: (keyof TaskState)[] }

/**
 * The state with a logged change taken back, each field it changed put back
 * as it was; unless any of them has changed since, which it won't overwrite.
 */
export const revertedState = (state: TaskState, changes: Record<string, FieldChange>): Reverted => {
  const fields = Object.keys(changes).filter((key): key is keyof TaskState => key in state)
  const changedSince = fields.filter(
    (key) => JSON.stringify(logged(key, state[key])) !== JSON.stringify(changes[key]?.to)
  )
  if (changedSince.length > 0) return { type: RevertType.CHANGED_SINCE, fields: changedSince }
  const after: Record<string, unknown> = { ...state }
  for (const key of fields) after[key] = unlogged(key, changes[key]?.from)
  const reverted = after as unknown as TaskState
  return { type: RevertType.REVERTED, outcome: { state: reverted, changes: changesBetween(state, reverted) } }
}

/** A change from one state to another, with what it changed. */
export const outcomeOf = (before: TaskState, after: TaskState): Outcome => ({
  state: after,
  changes: changesBetween(before, after)
})

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

/** Sets and clears fields. Filing a task in a domain takes it out of the Inbox, and putting it in an Inbox out of its domain. */
export const editTask = (before: TaskState, { set, clear }: Edit): Outcome => {
  const after: TaskState = { ...before }
  Object.assign(after, definedFields(set))
  for (const field of clear) after[field] = undefined
  if (set.domainId !== undefined) after.inboxUserId = undefined
  if (set.inboxUserId !== undefined) after.domainId = undefined
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

/** A checklist with its ticks taken off, for doing again; items made tasks follow their tasks. */
const unticked = (checklist: readonly StoredChecklistItem[]): readonly StoredChecklistItem[] =>
  checklist.some(({ done }) => done) ? checklist.map((item) => ({ ...item, done: false })) : checklist

/**
 * A repeating task once an occurrence is done or skipped: open, at its next
 * date, its due and start dates moved by as much, and its checklist to do
 * again.
 */
export const movedOn = (before: TaskState, next: IsoDate): Outcome => {
  const shift = before.scheduled === undefined ? 0 : daysBetween(before.scheduled, next)
  const shifted = (date: IsoDate | undefined): IsoDate | undefined => date && addDays(date, shift)
  const after: TaskState = {
    ...leavingStatus(before),
    status: TaskStatus.OPEN,
    scheduled: next,
    due: shifted(before.due),
    start: shifted(before.start),
    checklist: unticked(before.checklist)
  }
  return { state: after, changes: changesBetween(before, after) }
}

/**
 * What one change did, in two steps from `before`: each field from where it
 * started to where it ended up, and what else either step logged (the
 * occurrences recorded) alongside.
 */
export const changesAcross = (before: TaskState, first: Outcome, second: Outcome): Record<string, FieldChange> => ({
  ...Object.fromEntries(Object.entries({ ...first.changes, ...second.changes }).filter(([key]) => !(key in before))),
  ...changesBetween(before, second.state)
})

/** Every field a new task starts with, for the activity log. */
export const changesFromNothing = (state: TaskState): Record<string, FieldChange> =>
  Object.fromEntries(
    Object.entries(state)
      .filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0))
      .map(([key, value]) => [key, { to: logged(key as keyof TaskState, value) }])
  )
