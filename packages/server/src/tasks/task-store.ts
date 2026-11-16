import { and, eq, inArray, isNull, type SQL } from "drizzle-orm"
import { ProblemType } from "@taxa/shared/api/problem"
import type { TaskRef } from "@taxa/shared/tasks/task-ref"
import type { TaskStatus } from "@taxa/shared/tasks/task"
import type { Db } from "../database/database.ts"
import { domainMembers, domains, tasks } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import type { TaskRow } from "./task-rows.ts"

export interface FoundTask {
  row: TaskRow
  prefix: string
}

// Returns Drizzle's query builder, whose type is too intricate to write out.
// oxlint-disable-next-line typescript/explicit-function-return-type
const selectVisible = (db: Db, userId: string, where: SQL | undefined) =>
  db
    .select({ row: tasks, prefix: domains.prefix })
    .from(tasks)
    .innerJoin(domains, eq(domains.id, tasks.domainId))
    .innerJoin(domainMembers, and(eq(domainMembers.domainId, tasks.domainId), eq(domainMembers.userId, userId)))
    .where(where)

/**
 * A task this person can see, named by ref. `forUpdate` locks it until the
 * transaction ends, so concurrent changes to it happen one after another.
 */
export const findTask = async (db: Db, userId: string, ref: TaskRef, forUpdate = false): Promise<FoundTask> => {
  const byRef = ref.type === "ID" ? eq(tasks.id, ref.id) : eq(tasks.number, ref.number)
  const query = selectVisible(db, userId, byRef)
  const [found] = forUpdate ? await query.for("update", { of: tasks }) : await query
  if (!found) {
    const name = ref.type === "ID" ? ref.id : String(ref.number)
    throw new ProblemError(ProblemType.NOT_FOUND, `There's no task ${name} that you can see.`)
  }
  return found
}

export interface TaskFilter {
  domainId: string | undefined
  statuses: readonly TaskStatus[]
  inbox: boolean | undefined
}

/** The live (not deleted) tasks this person can see that match. */
export const findTasks = (db: Db, userId: string, { domainId, statuses, inbox }: TaskFilter): Promise<FoundTask[]> =>
  selectVisible(
    db,
    userId,
    and(
      isNull(tasks.deletedAt),
      inArray(tasks.status, [...statuses]),
      domainId === undefined ? undefined : eq(tasks.domainId, domainId),
      inbox === undefined ? undefined : eq(tasks.inbox, inbox)
    )
  )

export const taskIdExists = async (db: Db, id: string): Promise<boolean> =>
  (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id))).length > 0
