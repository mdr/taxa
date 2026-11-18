import { sessionId } from "../ids.ts"
import type { Session, SessionItem } from "../sessions/session.ts"
import type { Task } from "../tasks/task.ts"
import type { Minutes } from "../units.ts"

/** 2:00 pm UTC on the day tests' clocks start. */
const SESSION_START = "2026-01-05T14:00:00.000Z"

/** A task planned in a session for so long, untouched unless the fields say otherwise. */
export const planned = (task: Task, minutes: Minutes, fields: Partial<SessionItem> = {}): SessionItem => ({
  task,
  minutes,
  spentMs: 0,
  ...fields
})

/** A two-hour session from 2:00 pm, with nothing being worked on unless the fields say so. */
export const makeSession = (fields: Partial<Session> = {}): Session => ({
  id: sessionId("0190a1b2-0000-7000-8000-5e5510000001"),
  startedAt: SESSION_START,
  endsAt: "2026-01-05T16:00:00.000Z",
  items: [],
  note: "",
  version: 1,
  ...fields
})
