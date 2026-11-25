import { desc, and, eq, isNull } from "drizzle-orm"
import { ActivityType } from "@taxa/shared/activity/activity"
import type { Occurrence } from "@taxa/shared/tasks/occurrence"
import type { Task } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import { actorsNamed } from "../activity/actor-names.ts"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { occurrences } from "../database/schema.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"
import { occurrenceActorIds, occurrenceOf } from "./occurrence-rows.ts"
import { occurrenceRecorded, type Recording } from "./repeating.ts"
import { changeTask, lookupOf } from "./task-service.ts"
import { findTask } from "./task-store.ts"

/** Does or skips a repeating task's occurrence, moving it on to its next date. */
export const recordOccurrence = (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  ref: string,
  recording: Recording,
  now: Instant
): Promise<Task> =>
  changeTask(db, log, caller, ref, undefined, now, {
    type: ActivityType.TASK_OCCURRENCE_RECORDED,
    code: LOG_CODES.task.occurrenceRecorded,
    catchesUp: true,
    apply: (state, row, tx) => occurrenceRecorded(tx, caller, now, state, row, ref, recording)
  })

/** A repeating task's occurrences, the latest first, leaving out those taken back. */
export const listOccurrences = async (db: Db, caller: Caller, ref: string): Promise<Occurrence[]> => {
  const { row: task } = await findTask(db, caller.user.id, lookupOf(ref))
  const rows = await db
    .select()
    .from(occurrences)
    .where(and(eq(occurrences.taskId, task.id), isNull(occurrences.voidedAt)))
    .orderBy(desc(occurrences.date))
  const actorOf = await actorsNamed(db, occurrenceActorIds(rows))
  return rows.map((row) => occurrenceOf(row, actorOf))
}
