import type { TaskId } from "../ids.ts"
import type { Instant, Ms } from "../units.ts"
import { SessionOutcome, type Session, type SessionItem } from "./session.ts"

const MINUTE: Ms = 60_000

export enum SlotState {
  DONE = "DONE",
  STOPPED = "STOPPED",
  CURRENT = "CURRENT",
  /** Still to come; or, once the session's over, not got to. */
  NEXT = "NEXT"
}

/** One task's place in the session's time. */
export interface Slot {
  item: SessionItem
  state: SlotState
  start: Instant
  end: Instant
  /** All the time spent on it so far, including the stretch under way. */
  spent: Ms
  /** For the current task: how much longer it was meant to take, or, below zero, how far over it's run. */
  left: Ms
}

export interface Timeline {
  slots: Slot[]
  /** When the plan, as it stands, will be through. */
  finish: Instant
  /** Time to spare at the end; below zero, how far past the end the plan runs. */
  spare: Ms
  /** Until the session's end. */
  remaining: Ms
  current: Slot | undefined
  /** The first task still to come. */
  next: Slot | undefined
}

const instant = (iso: string): Instant => Date.parse(iso)

/** Time spent on a task in a session so far, the stretch under way included. */
const spentOn = (session: Session, item: SessionItem, now: Instant): Ms =>
  item.spentMs + (session.current?.taskId === item.task.id ? Math.max(0, now - instant(session.current.since)) : 0)

/**
 * The session laid out in time: finished tasks for as long as they took,
 * the current one from when work on it began, and the rest one after
 * another from then, each for the time planned less any already spent.
 */
export const sessionTimeline = (session: Session, now: Instant): Timeline => {
  const endsAt = instant(session.endsAt)
  let cursor = instant(session.startedAt)
  const slots = session.items.map((item): Slot => {
    const spent = spentOn(session, item, now)
    const planned = item.minutes * MINUTE
    if (item.outcome) {
      const start = cursor
      cursor += spent
      const state = item.outcome === SessionOutcome.DONE ? SlotState.DONE : SlotState.STOPPED
      return { item, state, start, end: cursor, spent, left: 0 }
    }
    if (session.current?.taskId === item.task.id) {
      const start = now - spent
      const plannedEnd = start + planned
      cursor = Math.max(plannedEnd, now)
      return { item, state: SlotState.CURRENT, start, end: cursor, spent, left: plannedEnd - now }
    }
    const start = session.endedAt ? cursor : Math.max(cursor, now)
    cursor = start + Math.max(planned - spent, 0)
    return { item, state: SlotState.NEXT, start, end: cursor, spent, left: 0 }
  })
  return {
    slots,
    finish: cursor,
    spare: endsAt - cursor,
    remaining: endsAt - now,
    current: slots.find(({ state }) => state === SlotState.CURRENT),
    next: slots.find(({ state }) => state === SlotState.NEXT)
  }
}

/** The next task still to do after the one given, going round to the start if need be; none if all are done. */
export const nextAfter = (session: Session, taskId: TaskId | undefined): TaskId | undefined => {
  const from = session.items.findIndex(({ task }) => task.id === taskId)
  const after = [...session.items.slice(from + 1), ...session.items.slice(0, Math.max(from, 0))]
  return after.find((item) => !item.outcome && item.task.id !== taskId)?.task.id
}
