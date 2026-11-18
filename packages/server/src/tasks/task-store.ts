import { and, eq, inArray, isNotNull, isNull, or, type SQL } from "drizzle-orm"
import { ProblemType } from "@taxa/shared/api/problem"
import type { DomainPrefix } from "@taxa/shared/domains/domain"
import type { DomainId, TaskId, UserId } from "@taxa/shared/ids"
import type { TaskLookup } from "@taxa/shared/tasks/task-ref"
import type { TaskStatus } from "@taxa/shared/tasks/task"
import type { Db } from "../database/database.ts"
import { domainMembers, domains, tasks } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { foundOf, type TaskRow } from "./task-rows.ts"

export interface FoundTask {
  row: TaskRow
  /** None while it's in the Inbox. */
  prefix: DomainPrefix | undefined
}

// Returns Drizzle's query builder, whose type is too intricate to write out.
// oxlint-disable-next-line typescript/explicit-function-return-type
const selectVisible = (db: Db, userId: UserId, where: SQL | undefined) =>
  // Filed in a domain they're a member of, or in their own Inbox.
  db
    .select({ row: tasks, prefix: domains.prefix })
    .from(tasks)
    .leftJoin(domains, eq(domains.id, tasks.domainId))
    .leftJoin(domainMembers, and(eq(domainMembers.domainId, tasks.domainId), eq(domainMembers.userId, userId)))
    .where(and(or(isNotNull(domainMembers.userId), eq(tasks.inboxUserId, userId)), where))

/**
 * A task this person can see, named by ref. `forUpdate` locks it until the
 * transaction ends, so concurrent changes to it happen one after another.
 */
export const findTask = async (db: Db, userId: UserId, ref: TaskLookup, forUpdate = false): Promise<FoundTask> => {
  const byRef = ref.type === "ID" ? eq(tasks.id, ref.id) : eq(tasks.number, ref.number)
  const query = selectVisible(db, userId, byRef)
  const [found] = forUpdate ? await query.for("update", { of: tasks }) : await query
  if (!found) {
    const name = ref.type === "ID" ? ref.id : String(ref.number)
    throw new ProblemError(ProblemType.NOT_FOUND, `There's no task ${name} that you can see.`)
  }
  return foundOf(found)
}

export interface TaskFilter {
  domainId: DomainId | undefined
  statuses: readonly TaskStatus[]
  inbox: boolean | undefined
}

/** The live (not deleted) tasks this person can see that match. */
export const findTasks = async (
  db: Db,
  userId: UserId,
  { domainId, statuses, inbox }: TaskFilter
): Promise<FoundTask[]> =>
  (
    await selectVisible(
      db,
      userId,
      and(
        isNull(tasks.deletedAt),
        inArray(tasks.status, [...statuses]),
        domainId === undefined ? undefined : eq(tasks.domainId, domainId),
        inbox === undefined ? undefined : inbox ? isNotNull(tasks.inboxUserId) : isNotNull(tasks.domainId)
      )
    )
  ).map(foundOf)

export const taskIdExists = async (db: Db, id: TaskId): Promise<boolean> =>
  (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id))).length > 0

/** The live tasks among these that this person can see. */
export const findTasksWithIds = async (db: Db, userId: UserId, ids: readonly TaskId[]): Promise<FoundTask[]> =>
  ids.length === 0
    ? []
    : (await selectVisible(db, userId, and(isNull(tasks.deletedAt), inArray(tasks.id, [...ids])))).map(foundOf)
