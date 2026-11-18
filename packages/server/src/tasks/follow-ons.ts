import { ProblemType } from "@taxa/shared/api/problem"
import type { TaskId } from "@taxa/shared/ids"
import { parseTaskLookup } from "@taxa/shared/tasks/task-ref"
import { eq } from "drizzle-orm"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { tasks } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { findTask } from "./task-store.ts"

/** Further back than any real trail of follow-ons goes: past it, something's wrong. */
const LONGEST_TRAIL = 1000

/** The task one follows on from, if any. */
const earlierOf = async (db: Db, id: TaskId): Promise<TaskId | undefined> => {
  const [row] = await db.select({ followsOnId: tasks.followsOnId }).from(tasks).where(eq(tasks.id, id))
  return row?.followsOnId ?? undefined
}

/**
 * The task named, by ref or id, for a task to follow on from: one the caller
 * can see, not deleted, and not the task itself or any that follows on from
 * it, which would make the trail a loop.
 */
export const followsOnIdFor = async (
  db: Db,
  caller: Caller,
  followsOn: string,
  taskId: TaskId | undefined
): Promise<TaskId> => {
  const lookup = parseTaskLookup(followsOn)
  if (!lookup)
    throw new ProblemError(
      ProblemType.INVALID_REQUEST,
      `${JSON.stringify(followsOn)} isn't a task: try H-142, 142 or an id.`
    )
  const { row } = await findTask(db, caller.user.id, lookup)
  if (row.deletedAt) throw new ProblemError(ProblemType.INVALID_REQUEST, "A task can't follow on from a deleted one.")
  let at: TaskId | undefined = row.id
  for (let step = 0; at !== undefined && step < LONGEST_TRAIL; step++) {
    if (at === taskId)
      throw new ProblemError(
        ProblemType.INVALID_REQUEST,
        "A task can't follow on from itself, or from one that follows on from it."
      )
    at = await earlierOf(db, at)
  }
  return row.id
}
