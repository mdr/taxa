import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm"
import { ProblemType } from "@taxa/shared/api/problem"
import { BIN_KEEPS_MS, UNCREATED_KEEPS_MS } from "@taxa/shared/tasks/bin"
import { TaskStatus } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { tasks } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { callerFields } from "../telemetry/change-fields.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"
import { purge } from "./purging.ts"
import { lookupOf } from "./task-service.ts"
import { findTask, findTasks } from "./task-store.ts"

/** Deletes a task in the bin for good. */
export const purgeTask = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  ref: string,
  now: Instant
): Promise<void> => {
  const { row } = await db.transaction(async (tx) => {
    const found = await findTask(tx, caller.user.id, lookupOf(ref), true)
    if (!found.row.deletedAt)
      throw new ProblemError(
        ProblemType.INVALID_REQUEST,
        `${ref} isn't in the bin: delete it before deleting it for good.`
      )
    await purge(tx, [found.row.id], now)
    return found
  })
  log.info(LOG_CODES.task.purged, "deleted a task for good", {
    ...callerFields(caller),
    taskId: row.id,
    domainId: row.domainId
  })
}

/** Deletes for good every task in the bin that this person can see. */
export const emptyBin = async (db: Db, log: ServerLogger, caller: Caller, now: Instant): Promise<number> => {
  const purged = await db.transaction(async (tx) => {
    const found = await findTasks(tx, caller.user.id, {
      domainId: undefined,
      statuses: Object.values(TaskStatus),
      inbox: undefined,
      deleted: true
    })
    const ids = found.map(({ row }) => row.id)
    await purge(tx, ids, now)
    return ids.length
  })
  if (purged > 0) log.info(LOG_CODES.bin.emptied, "emptied the bin", { ...callerFields(caller), count: purged })
  return purged
}

/**
 * Deletes for good every task that's been in the bin longer than it keeps
 * them, whoever's it is, and those uncreated by undos kept long enough to redo.
 */
export const clearOldBin = async (db: Db, log: ServerLogger, now: Instant): Promise<number> => {
  const purged = await db.transaction(async (tx) => {
    const old = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          isNotNull(tasks.deletedAt),
          isNull(tasks.purgedAt),
          or(
            lt(tasks.deletedAt, new Date(now - BIN_KEEPS_MS)),
            and(eq(tasks.uncreated, true), lt(tasks.deletedAt, new Date(now - UNCREATED_KEEPS_MS)))
          )
        )
      )
      .for("update")
    await purge(
      tx,
      old.map(({ id }) => id),
      now
    )
    return old.length
  })
  if (purged > 0) log.info(LOG_CODES.bin.cleared, "cleared old tasks out of the bin", { count: purged })
  return purged
}
