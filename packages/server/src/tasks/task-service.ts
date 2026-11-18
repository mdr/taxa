import { inPlanOrder } from "@taxa/shared/days/day-plan"
import { getDayPlan } from "../days/day-plan-service.ts"
import { DEFAULT_WHENS, When, whenOf } from "@taxa/shared/tasks/when"
import { eq } from "drizzle-orm"
import type { z } from "zod"
import { ActivityType, type Activity, type FieldChange } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import { dateIn } from "@taxa/shared/dates/plain-date"
import { taskId as newTaskId, uuidv7, type DomainId, type TaskId, type UserId } from "@taxa/shared/ids"
import { compareTasks } from "@taxa/shared/tasks/task-order"
import { matchesSearch, searchResults } from "@taxa/shared/tasks/task-search"
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
import { findDomain } from "../domains/domain-store.ts"
import { ProblemError } from "../http/problem-error.ts"
import { callerFields } from "../telemetry/change-fields.ts"
import { LOG_CODES, type ServerLogCode, type ServerLogger } from "../telemetry/log.ts"
import { Deletion, deletedAtFor, inProgressIdsOf, stateOf, taskOf, valuesOf, type TaskRow } from "./task-rows.ts"
import { changeStatus, changesFromNothing, editTask, type Outcome, type TaskState } from "./task-state.ts"
import { findTask, findTasks, findTasksWithIds, taskIdExists, type FoundTask } from "./task-store.ts"

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

const parseWhens = (text: string | undefined): ReadonlySet<When> => {
  if (text === undefined) return new Set(DEFAULT_WHENS)
  const whens = text.split(",").map((when) => when.trim().toUpperCase())
  const unknown = whens.filter((when) => !Object.values<string>(When).includes(when))
  if (unknown.length) {
    throw new ProblemError(
      ProblemType.INVALID_REQUEST,
      `Unknown when ${unknown.join(", ")}: use ${Object.values(When).join(", ")}.`
    )
  }
  return new Set(whens as When[])
}

export const listTasks = async (db: Db, caller: Caller, query: ListTasksQuery, now: Instant): Promise<Task[]> => {
  const domainId = query.domain === undefined ? undefined : (await findDomain(db, caller.user.id, query.domain)).id
  const inbox = query.inbox === undefined ? undefined : query.inbox === "true"
  const found = await findTasks(db, caller.user.id, { domainId, statuses: parseStatuses(query.status), inbox })
  const today = dateIn(caller.user.timeZone, now)
  const whens = parseWhens(query.when)
  const started = found.filter(
    ({ row }) =>
      (query.includeNotStarted === "true" || !row.start || row.start <= today) &&
      whens.has(whenOf({ scheduled: row.scheduled ?? undefined, horizon: row.horizon ?? undefined }, today))
  )
  const { search } = query
  if (search === undefined) {
    const listed = (await tasksOf(db, started)).sort(compareTasks)
    return whens.size === 1 && whens.has(When.TODAY)
      ? inPlanOrder(listed, (await getDayPlan(db, caller, today)).taskIds)
      : listed
  }
  const matching = started.filter(({ row }) => matchesSearch(row, search))
  return searchResults((await tasksOf(db, matching)).sort(compareTasks), search)
}

/** The live tasks among these that the caller can see, by id. */
export const tasksWithIds = async (db: Db, caller: Caller, ids: readonly TaskId[]): Promise<Map<TaskId, Task>> =>
  new Map((await tasksOf(db, await findTasksWithIds(db, caller.user.id, ids))).map((task) => [task.id, task]))

export const getTask = async (db: Db, caller: Caller, ref: string): Promise<Task> =>
  taskFrom(db, await findTask(db, caller.user.id, lookupOf(ref)))

/** A change's log line: who, which task, where it is now, and which fields changed, never their values. */
const logChange = (
  log: ServerLogger,
  code: ServerLogCode,
  caller: Caller,
  task: Task,
  changes: Record<string, FieldChange>
): void =>
  log.info(code, `${task.ref} changed`, {
    ...callerFields(caller),
    taskId: task.id,
    taskRef: task.ref,
    domainId: task.domainId,
    version: task.version,
    fields: Object.keys(changes).join(",")
  })

export const createTask = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  { id, domain, title, ...fields }: z.infer<typeof CreateTaskRequestSchema>,
  now: Instant
): Promise<Task> => {
  const { task, changes } = await db.transaction(async (tx) => {
    const taskId = id ?? newTaskId(uuidv7(now))
    if (await taskIdExists(tx, taskId))
      throw new ProblemError(ProblemType.INVALID_REQUEST, `A task with id ${taskId} already exists.`)
    const domainId = domain === undefined ? undefined : (await findDomain(tx, caller.user.id, domain)).id
    const inboxUserId = domainId === undefined ? caller.user.id : undefined
    const state = editTask(blankState(domainId, inboxUserId, title), { set: fields, clear: [] }).state
    const at = new Date(now)
    await tx.insert(tasks).values({ id: taskId, ...valuesOf(state), createdAt: at, updatedAt: at, version: 1 })
    const created = changesFromNothing(state)
    await recordActivity(tx, caller, now, {
      type: ActivityType.TASK_CREATED,
      entityId: taskId,
      domainId,
      changes: created
    })
    return {
      task: await taskFrom(tx, await findTask(tx, caller.user.id, { type: "ID", id: taskId })),
      changes: created
    }
  })
  logChange(log, LOG_CODES.task.created, caller, task, changes)
  return task
}

const blankState = (domainId: DomainId | undefined, inboxUserId: UserId | undefined, title: string): TaskState => ({
  domainId,
  inboxUserId,
  title,
  notes: "",
  status: TaskStatus.OPEN,
  priority: Priority.NORMAL,
  due: undefined,
  scheduled: undefined,
  scheduledTime: undefined,
  start: undefined,
  estimateMinutes: undefined,
  energy: undefined,
  horizon: undefined,
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
  code: ServerLogCode
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
  log: ServerLogger,
  caller: Caller,
  ref: string,
  ifMatch: number | undefined,
  now: Instant,
  { type, code, apply }: Change
): Promise<Task> => {
  const { task, changes } = await db.transaction(async (tx) => {
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
    if (Object.keys(changes).length === 0) return { task: await taskFrom(tx, found), changes }
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
    return { task: await taskFrom(tx, await findTask(tx, caller.user.id, { type: "ID", id: row.id })), changes }
  })
  // Only changes that changed something: an edit that matches the task as it is has no effect to log.
  if (Object.keys(changes).length > 0) logChange(log, code, caller, task, changes)
  return task
}

export const updateTask = (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  ref: string,
  { set: { domain, inbox, ...set }, clear }: z.infer<typeof UpdateTaskRequestSchema>,
  ifMatch: number | undefined,
  now: Instant
): Promise<Task> =>
  changeTask(db, log, caller, ref, ifMatch, now, {
    type: ActivityType.TASK_UPDATED,
    code: LOG_CODES.task.updated,
    apply: async (state, _row, tx) => {
      if (domain !== undefined && inbox)
        throw new ProblemError(ProblemType.INVALID_REQUEST, "A task is either in a domain or in the Inbox, not both.")
      const domainId = domain === undefined ? undefined : (await findDomain(tx, caller.user.id, domain)).id
      const inboxUserId = inbox && state.inboxUserId === undefined ? caller.user.id : undefined
      return editTask(state, {
        set: { ...set, ...(domainId && { domainId }), ...(inboxUserId && { inboxUserId }) },
        clear
      })
    }
  })

export const changeTaskStatus = (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  ref: string,
  request: z.infer<typeof ChangeStatusRequestSchema>,
  ifMatch: number | undefined,
  now: Instant
): Promise<Task> =>
  changeTask(db, log, caller, ref, ifMatch, now, {
    type: ActivityType.TASK_STATUS_CHANGED,
    code: LOG_CODES.task.statusChanged,
    apply: async (state) =>
      changeStatus(state, request, { actor: idsOf(caller), today: dateIn(caller.user.timeZone, now), now })
  })

export const deleteTask = (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  ref: string,
  ifMatch: number | undefined,
  now: Instant
): Promise<Task> =>
  changeTask(db, log, caller, ref, ifMatch, now, {
    type: ActivityType.TASK_DELETED,
    code: LOG_CODES.task.deleted,
    apply: async (state, row) => ({
      state,
      changes: row.deletedAt ? NO_CHANGES : { deletedAt: { to: new Date(now).toISOString() } },
      deletion: Deletion.DELETE
    })
  })

export const restoreTask = (db: Db, log: ServerLogger, caller: Caller, ref: string, now: Instant): Promise<Task> =>
  changeTask(db, log, caller, ref, undefined, now, {
    type: ActivityType.TASK_RESTORED,
    code: LOG_CODES.task.restored,
    apply: async (state, row) => ({
      state,
      changes: row.deletedAt ? { deletedAt: { from: row.deletedAt.toISOString() } } : NO_CHANGES,
      deletion: Deletion.RESTORE
    })
  })

export const taskActivity = async (db: Db, caller: Caller, ref: string): Promise<Activity[]> =>
  activityOf(db, (await findTask(db, caller.user.id, lookupOf(ref))).row.id)
