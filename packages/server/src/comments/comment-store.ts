import { and, asc, inArray, isNull } from "drizzle-orm"
import type { TaskId } from "@taxa/shared/ids"
import type { Db } from "../database/database.ts"
import { comments } from "../database/schema.ts"

/** What the comments on each of these tasks say, leaving out deleted ones, oldest first. */
export const commentBodiesOf = async (db: Db, taskIds: readonly TaskId[]): Promise<Map<TaskId, string[]>> => {
  const bodies = new Map<TaskId, string[]>()
  if (taskIds.length === 0) return bodies
  const rows = await db
    .select({ taskId: comments.taskId, body: comments.body })
    .from(comments)
    .where(and(inArray(comments.taskId, [...taskIds]), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt))
  for (const { taskId, body } of rows) bodies.set(taskId, [...(bodies.get(taskId) ?? []), body])
  return bodies
}
