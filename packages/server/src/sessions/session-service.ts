import { and, eq, isNull } from "drizzle-orm"
import type { z } from "zod"
import { ProblemType } from "@taxa/shared/api/problem"
import { SessionIdSchema, sessionId as newSessionId, uuidv7, type TaskId } from "@taxa/shared/ids"
import type { CreateSessionRequestSchema, Session, UpdateSessionRequestSchema } from "@taxa/shared/sessions/session"
import type { Instant } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { sessions } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { changeTaskStatus, tasksWithIds } from "../tasks/task-service.ts"
import { callerFields } from "../telemetry/change-fields.ts"
import { LOG_CODES, type ServerLogCode, type ServerLogger } from "../telemetry/log.ts"
import { recordOf, sessionOf, sessionValues, type SessionRecord } from "./session-rows.ts"
import {
  newSession,
  statusMoves,
  updateSession as applyUpdate,
  withoutGoneCurrent,
  type SessionState
} from "./session-state.ts"

const taskIdsOf = (state: SessionState): TaskId[] => state.items.map(({ taskId }) => taskId)

const shown = async (db: Db, caller: Caller, record: SessionRecord): Promise<Session> =>
  sessionOf(record, await tasksWithIds(db, caller, taskIdsOf(record.state)))

/** Every task planned has to be one the caller can see. */
const checkVisible = async (db: Db, caller: Caller, ids: readonly TaskId[]): Promise<void> => {
  const visible = await tasksWithIds(db, caller, ids)
  const missing = ids.filter((id) => !visible.has(id))
  if (missing.length)
    throw new ProblemError(ProblemType.NOT_FOUND, `There's no task ${missing.join(", ")} that you can see.`)
}

/** Moves the session's tasks on as its change asks: started ones in progress, finished ones done, the rest back to open. */
const moveTasks = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  before: SessionState | undefined,
  after: SessionState,
  now: Instant
): Promise<void> => {
  const moves = statusMoves(before, after)
  const tasks = await tasksWithIds(
    db,
    caller,
    moves.map(({ taskId }) => taskId)
  )
  for (const { taskId, to, from } of moves) {
    const task = tasks.get(taskId)
    if (task && from.includes(task.status))
      await changeTaskStatus(db, log, caller, taskId, { status: to }, undefined, now)
  }
}

const logSession = (
  log: ServerLogger,
  code: ServerLogCode,
  caller: Caller,
  record: SessionRecord,
  changed: string
): void =>
  log.info(code, `session ${changed}`, {
    ...callerFields(caller),
    sessionId: record.id,
    version: record.version,
    taskId: record.state.current?.taskId,
    tasks: record.state.items.length,
    changed
  })

/** Your session under way, if there is one. */
export const currentSession = async (db: Db, caller: Caller): Promise<Session | undefined> => {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, caller.user.id), isNull(sessions.endedAt)))
  return row ? shown(db, caller, recordOf(row)) : undefined
}

const findSession = async (db: Db, caller: Caller, id: string, forUpdate = false): Promise<SessionRecord> => {
  const parsed = SessionIdSchema.safeParse(id)
  if (!parsed.success) throw new ProblemError(ProblemType.NOT_FOUND, `You have no session ${id}.`)
  const query = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, parsed.data), eq(sessions.userId, caller.user.id)))
  const [row] = forUpdate ? await query.for("update") : await query
  if (!row) throw new ProblemError(ProblemType.NOT_FOUND, `You have no session ${id}.`)
  return recordOf(row)
}

export const getSession = async (db: Db, caller: Caller, id: string): Promise<Session> =>
  shown(db, caller, await findSession(db, caller, id))

export const createSession = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  { id, endsAt, items, start }: z.infer<typeof CreateSessionRequestSchema>,
  now: Instant
): Promise<Session> => {
  await checkVisible(
    db,
    caller,
    items.map(({ taskId }) => taskId)
  )
  const state = newSession(Date.parse(endsAt), items, start, now)
  const record = await db.transaction(async (tx) => {
    const [open] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, caller.user.id), isNull(sessions.endedAt)))
    if (open)
      throw new ProblemError(ProblemType.SESSION_OPEN, "You're already in a session: end it before starting another.")
    const at = new Date(now)
    const [row] = await tx
      .insert(sessions)
      .values({
        id: id ?? newSessionId(uuidv7(now)),
        userId: caller.user.id,
        ...sessionValues(state),
        createdAt: at,
        updatedAt: at,
        version: 1
      })
      .returning()
    return recordOf(row!)
  })
  logSession(log, LOG_CODES.session.created, caller, record, "created")
  await moveTasks(db, log, caller, undefined, state, now)
  return shown(db, caller, record)
}

/** Which parts of a session an update changed, for its log line. */
const changedParts = (update: z.infer<typeof UpdateSessionRequestSchema>): string =>
  [
    update.finish && `finish:${update.finish}`,
    ...Object.keys(update.set ?? {}),
    update.start && "start",
    update.end && "end"
  ]
    .filter(Boolean)
    .join(",")

export const updateSession = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  id: string,
  update: z.infer<typeof UpdateSessionRequestSchema>,
  ifMatch: number | undefined,
  now: Instant
): Promise<Session> => {
  if (update.set?.items)
    await checkVisible(
      db,
      caller,
      update.set.items.map(({ taskId }) => taskId)
    )
  const { before, after } = await db.transaction(async (tx) => {
    const found = await findSession(tx, caller, id, true)
    if (ifMatch !== undefined && ifMatch !== found.version)
      throw new ProblemError(
        ProblemType.VERSION_CONFLICT,
        `The session has changed since version ${ifMatch}: it's at version ${found.version} now.`,
        await shown(tx, caller, found)
      )
    const live = new Set((await tasksWithIds(tx, caller, taskIdsOf(found.state))).keys())
    const state = applyUpdate(
      withoutGoneCurrent(found.state, live, now),
      {
        ...update,
        set: update.set && {
          ...update.set,
          endsAt: update.set.endsAt === undefined ? undefined : Date.parse(update.set.endsAt)
        }
      },
      now
    )
    if (state === found.state) return { before: found, after: found }
    const version = found.version + 1
    await tx
      .update(sessions)
      .set({ ...sessionValues(state), updatedAt: new Date(now), version })
      .where(eq(sessions.id, found.id))
    return { before: found, after: { ...found, state, version } }
  })
  if (after !== before) {
    const ended = after.state.endedAt !== undefined && before.state.endedAt === undefined
    logSession(log, ended ? LOG_CODES.session.ended : LOG_CODES.session.changed, caller, after, changedParts(update))
    await moveTasks(db, log, caller, before.state, after.state, now)
  }
  return shown(db, caller, after)
}
