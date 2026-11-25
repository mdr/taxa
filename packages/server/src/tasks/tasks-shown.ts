import { and, eq, inArray, isNull } from "drizzle-orm"
import type { TaskId } from "@taxa/shared/ids"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { formatTaskRef } from "@taxa/shared/tasks/task-ref"
import { actorsNamed } from "../activity/actor-names.ts"
import type { Db } from "../database/database.ts"
import { domains, tasks } from "../database/schema.ts"
import { inProgressIdsOf, taskOf, type ItemTask } from "./task-rows.ts"
import type { FoundTask } from "./task-store.ts"

/** The tasks their checklists' items were made into, by id: their refs, and whether they're done. */
const itemTasksOf = async (db: Db, found: readonly FoundTask[]): Promise<Map<TaskId, ItemTask>> => {
  const ids = found.flatMap(({ row }) => row.checklist.flatMap(({ taskId }) => taskId ?? []))
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({ id: tasks.id, number: tasks.number, status: tasks.status, prefix: domains.prefix })
    .from(tasks)
    .leftJoin(domains, eq(domains.id, tasks.domainId))
    .where(and(inArray(tasks.id, ids), isNull(tasks.deletedAt)))
  return new Map(
    rows.map(({ id, number, status, prefix }) => [
      id,
      { ref: formatTaskRef(prefix ?? undefined, number), done: status === TaskStatus.DONE }
    ])
  )
}

export const tasksOf = async (db: Db, found: readonly FoundTask[]): Promise<Task[]> => {
  const actorOf = await actorsNamed(
    db,
    found.flatMap(({ row }) => inProgressIdsOf(row) ?? [])
  )
  const itemTasks = await itemTasksOf(db, found)
  return found.map(({ row, prefix }) => taskOf(row, prefix, actorOf, (id) => itemTasks.get(id)))
}

export const taskFrom = async (db: Db, found: FoundTask): Promise<Task> => (await tasksOf(db, [found]))[0]!
