import { and, eq, isNull } from "drizzle-orm"
import type { TaskId } from "@taxa/shared/ids"
import type { Instant } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { sessions } from "../database/schema.ts"
import { callerFields } from "../telemetry/change-fields.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"
import { recordOf, sessionValues, type SessionRecord } from "./session-rows.ts"
import { stopTask } from "./session-state.ts"

/**
 * Stops a task just deleted wherever it's under way, as part of deleting it:
 * its time ends there, and if it comes back (an undo), it waits to be started.
 */
export const stopDeletedTask = async (tx: Db, taskId: TaskId, now: Instant): Promise<SessionRecord[]> => {
  const rows = await tx
    .select()
    .from(sessions)
    .where(and(eq(sessions.currentTaskId, taskId), isNull(sessions.endedAt)))
    .for("update")
  return Promise.all(
    rows.map(async (row) => {
      const found = recordOf(row)
      const stopped = { ...found, state: stopTask(found.state, taskId, now), version: found.version + 1 }
      await tx
        .update(sessions)
        .set({ ...sessionValues(stopped.state), updatedAt: new Date(now), version: stopped.version })
        .where(eq(sessions.id, found.id))
      return stopped
    })
  )
}

export const logStopped = (log: ServerLogger, caller: Caller, record: SessionRecord, taskId: TaskId): void =>
  log.info(LOG_CODES.session.changed, "session task deleted", {
    ...callerFields(caller),
    sessionId: record.id,
    version: record.version,
    taskId,
    tasks: record.state.items.length,
    changed: "taskDeleted"
  })
