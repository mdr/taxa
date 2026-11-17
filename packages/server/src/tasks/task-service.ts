import { eq } from "drizzle-orm"
import type { z } from "zod"
import { ActivityType, type Activity, type FieldChange } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import { dateIn } from "@taxa/shared/dates/plain-date"
import { taskId as newTaskId, uuidv7, type DomainId } from "@taxa/shared/ids"
import { compareTasks } from "@taxa/shared/tasks/task-order"
import { parseTaskLookup, type TaskLookup } from "@taxa/shared/tasks/task-ref"
import type {
  ChangeStatusRequestSchema,
  CreateTaskRequestSchema,
  ListTasksQuery,
  UpdateTaskRequestSchema
} from "@taxa/shared/tasks/task-requests"
import { ACTIVE_STATUSES, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import { activityOf, recordActivity } from "../activity/activity-store.ts"
import { actorsNamed, type ActorIds } from "../activity/actor-names.ts"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { tasks } from "../database/schema.ts"
import { domainsOf, findDomain } from "../domains/domain-store.ts"
import { ProblemError } from "../http/problem-error.ts"
import { Deletion, deletedAtFor, inProgressIdsOf, stateOf, taskOf, valuesOf, type TaskRow } from "./task-rows.ts"
import { changeStatus, changesFromNothing, editTask, type Outcome, type TaskState } from "./task-state.ts"
import { findTask, findTasks, taskIdExists, type FoundTask } from "./task-store.ts"

const lookupOf = (text: string): TaskLookup => {
  const ref = parseTaskLookup(text)
  if (!ref)
    throw new ProblemError(
      ProblemType.INVALID_REQUEST,
      `${JSON.stringify(text)} isn't a task: try H-142, 142 or an id.`
    )
  return ref
}

const idsOf = (caller: Caller): ActorIds => ({
  userId: caller.user.id,
  agentId: caller.agent?.id,
  agentContext: caller.agentContext
})

const tasksOf = async (db: Db, found: readonly FoundTask[]): Promise<Task[]> => {
  const actorOf = await actorsNamed(
    db,
    found.flatMap(({ row }) => inProgressIdsOf(row) ?? [])
  )
  return found.map(({ row, prefix }) => taskOf(row, prefix, actorOf))
}

const taskFrom = async (db: Db, found: FoundTask): Promise<Task> => (await tasksOf(db, [found]))[0]!

const parseStatuses = (text: string | undefined): TaskStatus[] => {
  if (text === undefined) return [...ACTIVE_STATUSES]
  const statuses = text.split(",").map((status) => status.trim().toUpperCase())
  const unknown = statuses.filter((status) => !Object.values<string>(TaskStatus).includes(status))
  if (unknown.length) {
    throw new ProblemError(
      ProblemType.INVALID_REQUEST,
      `Unknown status ${unknown.join(", ")}: use ${Object.values(TaskStatus).join(", ")}.`
    )
  }
  return statuses as TaskStatus[]
}

export const listTasks = async (db: Db, caller: Caller, query: ListTasksQuery, now: Instant): Promise<Task[]> => {
  const domainId = query.domain === undefined ? undefined : (await findDomain(db, caller.user.id, query.domain)).id
  const inbox = query.inbox === undefined ? undefined : query.inbox === "true"
  const found = await findTasks(db, caller.user.id, { domainId, statuses: parseStatuses(query.status), inbox })
  const today = dateIn(caller.user.timeZone, now)
  const started =
    query.includeNotStarted === "true" ? found : found.filter(({ row }) => !row.start || row.start <= today)
  return (await tasksOf(db, started)).sort(compareTasks)
}

export const getTask = async (db: Db, caller: Caller, ref: string): Promise<Task> =>
  taskFrom(db, await findTask(db, caller.user.id, lookupOf(ref)))

/** Where a new task goes when the request names no domain: the person's default, else their first. */
const defaultDomainId = async (db: Db, caller: Caller): Promise<DomainId> => {
  const domains = await domainsOf(db, caller.user.id)
  const domain = domains.find(({ id }) => id === caller.user.defaultDomainId) ?? domains[0]
  if (!domain) throw new ProblemError(ProblemType.NO_DOMAIN, "Create a domain first: every task belongs to one.")
  return domain.id
}

export const createTask = async (
  db: Db,
  caller: Caller,
  { id, domain, title, ...fields }: z.infer<typeof CreateTaskRequestSchema>,
  now: Instant
): Promise<Task> =>
  db.transaction(async (tx) => {
    const taskId = id ?? newTaskId(uuidv7(now))
    if (await taskIdExists(tx, taskId))
      throw new ProblemError(ProblemType.INVALID_REQUEST, `A task with id ${taskId} already exists.`)
    const domainId =
      domain === undefined ? await defaultDomainId(tx, caller) : (await findDomain(tx, caller.user.id, domain)).id
    const state: TaskState = {
      ...editTask(blankState(domainId, title, domain === undefined), { set: fields, clear: [] }).state
    }
    const at = new Date(now)
    await tx.insert(tasks).values({ id: taskId, ...valuesOf(state), createdAt: at, updatedAt: at, version: 1 })
    await recordActivity(tx, caller, now, {
      type: ActivityType.TASK_CREATED,
      entityId: taskId,
      domainId,
      changes: changesFromNothing(state)
    })
    return taskFrom(tx, await findTask(tx, caller.user.id, { type: "ID", id: taskId }))
  })

const blankState = (domainId: DomainId, title: string, inbox: boolean): TaskState => ({
  domainId,
  title,
  notes: "",
  status: TaskStatus.OPEN,
  priority: Priority.NORMAL,
  inbox,
  due: undefined,
  scheduled: undefined,
  scheduledTime: undefined,
  start: undefined,
  estimateMinutes: undefined,
  energy: undefined,
  inProgressBy: undefined,
  waitingOn: undefined,
  followUp: undefined,
  completedAt: undefined,
  cancelledAt: undefined,
  cancelledReason: undefined
})

const NO_CHANGES: Record<string, FieldChange> = {}

interface Change {
  type: ActivityType
  /** What the change does to the task's state, and whether it deletes or restores it. */
  apply: (state: TaskState, row: TaskRow, tx: Db) => Promise<Outcome & { deletion?: Deletion }>
}

/**
 * Changes one task in a transaction: locks it, refuses if `ifMatch` isn't
 * its version, and when anything changed, saves it with its version one up
 * and logs what changed.
 */
const changeTask = async (
  db: Db,
  caller: Caller,
  ref: string,
  ifMatch: number | undefined,
  now: Instant,
  { type, apply }: Change
): Promise<Task> =>
  db.transaction(async (tx) => {
    const found = await findTask(tx, caller.user.id, lookupOf(ref), true)
    const { row } = found
    if (ifMatch !== undefined && ifMatch !== row.version) {
      throw new ProblemError(
        ProblemType.VERSION_CONFLICT,
        `${ref} has changed since version ${ifMatch}: it's at version ${row.version} now.`,
        await taskFrom(tx, found)
      )
    }
    const { state, changes, deletion } = await apply(stateOf(row), row, tx)
    if (Object.keys(changes).length === 0) return taskFrom(tx, found)
    await tx
      .update(tasks)
      .set({
        ...valuesOf(state),
        ...(deletion && { deletedAt: deletedAtFor(deletion, now) }),
        updatedAt: new Date(now),
        version: row.version + 1
      })
      .where(eq(tasks.id, row.id))
    await recordActivity(tx, caller, now, { type, entityId: row.id, domainId: state.domainId, changes })
    return taskFrom(tx, await findTask(tx, caller.user.id, { type: "ID", id: row.id }))
  })

export const updateTask = (
  db: Db,
  caller: Caller,
  ref: string,
  { set: { domain, ...set }, clear }: z.infer<typeof UpdateTaskRequestSchema>,
  ifMatch: number | undefined,
  now: Instant
): Promise<Task> =>
  changeTask(db, caller, ref, ifMatch, now, {
    type: ActivityType.TASK_UPDATED,
    apply: async (state, _row, tx) => {
      const domainId = domain === undefined ? undefined : (await findDomain(tx, caller.user.id, domain)).id
      return editTask(state, { set: { ...set, ...(domainId && { domainId }) }, clear })
    }
  })

export const changeTaskStatus = (
  db: Db,
  caller: Caller,
  ref: string,
  request: z.infer<typeof ChangeStatusRequestSchema>,
  ifMatch: number | undefined,
  now: Instant
): Promise<Task> =>
  changeTask(db, caller, ref, ifMatch, now, {
    type: ActivityType.TASK_STATUS_CHANGED,
    apply: async (state) =>
      changeStatus(state, request, { actor: idsOf(caller), today: dateIn(caller.user.timeZone, now), now })
  })

export const deleteTask = (
  db: Db,
  caller: Caller,
  ref: string,
  ifMatch: number | undefined,
  now: Instant
): Promise<Task> =>
  changeTask(db, caller, ref, ifMatch, now, {
    type: ActivityType.TASK_DELETED,
    apply: async (state, row) => ({
      state,
      changes: row.deletedAt ? NO_CHANGES : { deletedAt: { to: new Date(now).toISOString() } },
      deletion: Deletion.DELETE
    })
  })

export const restoreTask = (db: Db, caller: Caller, ref: string, now: Instant): Promise<Task> =>
  changeTask(db, caller, ref, undefined, now, {
    type: ActivityType.TASK_RESTORED,
    apply: async (state, row) => ({
      state,
      changes: row.deletedAt ? { deletedAt: { from: row.deletedAt.toISOString() } } : NO_CHANGES,
      deletion: Deletion.RESTORE
    })
  })

export const taskActivity = async (db: Db, caller: Caller, ref: string): Promise<Activity[]> =>
  activityOf(db, (await findTask(db, caller.user.id, lookupOf(ref))).row.id)
