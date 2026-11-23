import type { SessionId, TaskId, UserId } from "@taxa/shared/ids"
import type { Session } from "@taxa/shared/sessions/session"
import type { Task } from "@taxa/shared/tasks/task"
import type { Instant, Version } from "@taxa/shared/units"
import type { sessions } from "../database/schema.ts"
import type { SessionState } from "./session-state.ts"

export type SessionRow = typeof sessions.$inferSelect

const iso = (instant: Instant): string => new Date(instant).toISOString()

const stateOfSession = (row: SessionRow): SessionState => ({
  startedAt: row.startedAt.getTime(),
  endsAt: row.endsAt.getTime(),
  items: row.items,
  current:
    row.currentTaskId && row.currentSince
      ? { taskId: row.currentTaskId, since: row.currentSince.getTime() }
      : undefined,
  note: row.note,
  endedAt: row.endedAt?.getTime()
})

/** The columns a session's state is kept in. */
export const sessionValues = (
  state: SessionState
): Pick<SessionRow, "startedAt" | "endsAt" | "items" | "currentTaskId" | "currentSince" | "note" | "endedAt"> => ({
  startedAt: new Date(state.startedAt),
  endsAt: new Date(state.endsAt),
  items: state.items,
  currentTaskId: state.current?.taskId ?? null,
  currentSince: state.current ? new Date(state.current.since) : null,
  note: state.note,
  endedAt: state.endedAt === undefined ? null : new Date(state.endedAt)
})

export interface SessionRecord {
  id: SessionId
  userId: UserId
  version: Version
  state: SessionState
}

export const recordOf = (row: SessionRow): SessionRecord => ({
  id: row.id,
  userId: row.userId,
  version: row.version,
  state: stateOfSession(row)
})

/** As the API shows it, with each task as it is now; tasks no longer visible are left out. */
export const sessionOf = ({ id, version, state }: SessionRecord, tasks: ReadonlyMap<TaskId, Task>): Session => ({
  id,
  startedAt: iso(state.startedAt),
  endsAt: iso(state.endsAt),
  items: state.items.flatMap(({ taskId, minutes, spentMs, outcome }) => {
    const task = tasks.get(taskId)
    return task ? [{ task, minutes, spentMs, ...(outcome ? { outcome } : {}) }] : []
  }),
  ...(state.current && tasks.has(state.current.taskId)
    ? { current: { taskId: state.current.taskId, since: iso(state.current.since) } }
    : {}),
  note: state.note,
  ...(state.endedAt === undefined ? {} : { endedAt: iso(state.endedAt) }),
  version
})
