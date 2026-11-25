import { inArray } from "drizzle-orm"
import { z } from "zod"
import { ProblemType } from "@taxa/shared/api/problem"
import { formatDay } from "@taxa/shared/dates/date-format"
import { dateIn, IsoDateSchema, type IsoDate } from "@taxa/shared/dates/plain-date"
import type { FieldChange } from "@taxa/shared/activity/activity"
import { occurrenceId, OccurrenceIdSchema, uuidv7, type OccurrenceId } from "@taxa/shared/ids"
import {
  caughtUp,
  firstOccurrence,
  nextOccurrence,
  OccurrenceOutcome,
  repeatOf,
  type RepeatRequest
} from "@taxa/shared/tasks/repeat"
import { TaskStatus } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { occurrences } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { recordedBy, restoredOccurrence } from "./occurrence-rows.ts"
import { stateOf, type TaskRow } from "./task-rows.ts"
import { movedOn, type Outcome, type TaskState } from "./task-state.ts"

const FINISHED: ReadonlySet<TaskStatus> = new Set([TaskStatus.DONE, TaskStatus.CANCELLED])

/**
 * A task as an edit leaves it, made to repeat as asked: a repeating task
 * always has a day it's next for, the first it comes round from today if it
 * had none, and that date beats a horizon. Clearing that day is refused.
 */
export const repeating = (
  before: TaskState,
  after: TaskState,
  request: RepeatRequest | undefined,
  today: IsoDate
): TaskState => {
  const repeat = request ? repeatOf(request, after.scheduled ?? today) : after.repeat
  if (!repeat) return after
  if (FINISHED.has(after.status))
    throw new ProblemError(ProblemType.INVALID_REQUEST, "A finished task can't repeat: reopen it first.")
  if (after.scheduled === undefined && before.repeat && before.scheduled !== undefined)
    throw new ProblemError(
      ProblemType.INVALID_REQUEST,
      "A repeating task always has a day it's next for: move it to another day, or stop it repeating."
    )
  return {
    ...after,
    repeat,
    scheduled: after.scheduled ?? firstOccurrence(repeat, today),
    horizon: undefined
  }
}

/** Refuses to cancel a repeating task, which would only skip a day of it. */
export const refuseCancelling = (state: TaskState, ref: string): void => {
  if (state.repeat)
    throw new ProblemError(
      ProblemType.INVALID_REQUEST,
      `${ref} repeats: skip this one (taxa skip ${ref}), or stop it repeating (--clear repeat) before cancelling it.`
    )
}

/** An occurrence as the activity log keeps it, so undo can find it again. */
const LoggedOccurrenceSchema = z.object({
  id: OccurrenceIdSchema,
  date: IsoDateSchema,
  outcome: z.enum(OccurrenceOutcome),
  on: IsoDateSchema
})

type LoggedOccurrence = z.infer<typeof LoggedOccurrenceSchema>

export interface Recording {
  outcome: OccurrenceOutcome.DONE | OccurrenceOutcome.SKIPPED
  /** The date it's for: refused unless it's the task's scheduled date. */
  date: IsoDate | undefined
}

/**
 * Does or skips a repeating task's occurrence: records it, for the date the
 * task's at, and moves the task on to its next. Refused if the task doesn't
 * repeat, or has moved on from the date asked for.
 */
export const occurrenceRecorded = async (
  tx: Db,
  caller: Caller,
  now: Instant,
  state: TaskState,
  row: TaskRow,
  ref: string,
  { outcome, date }: Recording
): Promise<Outcome> => {
  const { repeat, scheduled } = state
  if (!repeat || scheduled === undefined) throw new ProblemError(ProblemType.INVALID_REQUEST, `${ref} doesn't repeat.`)
  const today = dateIn(caller.user.timeZone, now)
  // The date it's at, or was at before missed days were caught up just now: as whoever asked saw it.
  if (date !== undefined && date !== scheduled && date !== stateOf(row).scheduled)
    throw new ProblemError(
      ProblemType.VERSION_CONFLICT,
      `${ref} has moved on to ${formatDay(scheduled, today)}: ${formatDay(date, today)}'s has been done or skipped already.`
    )
  const moved = movedOn(state, nextOccurrence(repeat, { scheduled, today, outcome }))
  const logged: LoggedOccurrence = { id: occurrenceId(uuidv7(now)), date: scheduled, outcome, on: today }
  const values: typeof occurrences.$inferInsert = {
    ...logged,
    taskId: row.id,
    at: new Date(now),
    ...recordedBy(caller),
    taskVersion: row.version + 1
  }
  await tx.insert(occurrences).values(values)
  return { ...moved, changes: { ...moved.changes, occurrence: { to: logged } } }
}

/** A missed day as the log keeps it. */
const LoggedMissedSchema = z.object({ id: OccurrenceIdSchema, date: IsoDateSchema })

type LoggedMissed = z.infer<typeof LoggedMissedSchema>

/**
 * A repeating task that skips missed days, caught up as of today: each day
 * it came round and went by recorded as missed, and the task moved on.
 * Undefined if there's nothing to catch up, or it's in progress or waiting.
 */
export const missedCaughtUp = async (
  tx: Db,
  caller: Caller,
  now: Instant,
  state: TaskState,
  row: TaskRow
): Promise<Outcome | undefined> => {
  const { repeat, scheduled } = state
  if (!repeat || scheduled === undefined || state.status !== TaskStatus.OPEN) return undefined
  const today = dateIn(caller.user.timeZone, now)
  const caught = caughtUp(repeat, scheduled, today)
  if (!caught) return undefined
  const missed: LoggedMissed[] = caught.missed.map((date) => ({ id: occurrenceId(uuidv7(now)), date }))
  const values: (typeof occurrences.$inferInsert)[] = missed.map(({ id, date }) => ({
    id,
    taskId: row.id,
    date,
    outcome: OccurrenceOutcome.MISSED,
    on: today,
    at: new Date(now),
    ...recordedBy(caller),
    taskVersion: row.version + 1
  }))
  await tx.insert(occurrences).values(values)
  const moved = movedOn(state, caught.next)
  return { ...moved, changes: { ...moved.changes, missed: { to: missed } } }
}

/** The changes that record occurrences: the one done or skipped, and the days missed. */
const OCCURRENCE_CHANGES = ["occurrence", "missed"] as const

const idsIn = (logged: unknown): OccurrenceId[] => {
  const parsed = z.array(z.object({ id: OccurrenceIdSchema })).safeParse(Array.isArray(logged) ? logged : [logged])
  if (!parsed.success) throw new ProblemError(ProblemType.INVALID_REQUEST, "That change has nothing left to undo.")
  return parsed.data.map(({ id }) => id)
}

/**
 * Undoing a change that recorded occurrences: they're voided, kept for
 * redoing, and the log says which; undoing that undo brings them back, as of
 * the task's next version.
 */
export const occurrencesReverted = async (
  tx: Db,
  now: Instant,
  row: TaskRow,
  changes: Record<string, FieldChange>
): Promise<Record<string, FieldChange>> => {
  const reverted: Record<string, FieldChange> = {}
  for (const key of OCCURRENCE_CHANGES) {
    const change = changes[key]
    if (!change) continue
    const recorded = change.to !== undefined
    await tx
      .update(occurrences)
      .set(recorded ? { voidedAt: new Date(now) } : restoredOccurrence(row.version + 1))
      .where(inArray(occurrences.id, idsIn(recorded ? change.to : change.from)))
    reverted[key] = recorded ? { from: change.to } : { to: change.from }
  }
  return reverted
}
