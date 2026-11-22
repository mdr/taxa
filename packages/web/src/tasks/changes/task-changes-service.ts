import { ProblemType } from "@taxa/shared/api/problem"
import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import type { TaskId } from "@taxa/shared/ids"
import type { ChangeStatusRequest, UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import { TaskSchema, type Task } from "@taxa/shared/tasks/task"
import type { Version } from "@taxa/shared/units"
import type { TaskCache } from "./task-cache.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { AbstractService } from "../../services/abstract-service.ts"
import { createServiceContext, useService, useServiceState } from "../../services/service-hooks.ts"
import type { Logger, LogFields } from "@taxa/shared/telemetry/log"
import type { Analytics } from "../../telemetry/analytics.ts"
import { ANALYTICS_CODES, LOG_CODES, type WebLogCode } from "../../telemetry/codes.ts"

export const CONFLICT_NOTICE =
  "Someone else changed this task just now, so your change wasn't saved. This is the task as it is now: make your change again if you still want it."

export enum TaskChangeType {
  UPDATE = "UPDATE",
  STATUS = "STATUS",
  DELETE = "DELETE",
  RESTORE = "RESTORE"
}

export type TaskChange =
  | { type: TaskChangeType.UPDATE; request: UpdateTaskRequest }
  | { type: TaskChangeType.STATUS; request: ChangeStatusRequest }
  | { type: TaskChangeType.DELETE }
  | { type: TaskChangeType.RESTORE }

/** What a change touched, for analytics: the fields it set or cleared, or the status it moved to. */
const changeFields = (change: TaskChange): LogFields => {
  switch (change.type) {
    case TaskChangeType.UPDATE:
      return {
        fields: [
          ...Object.keys(change.request.set ?? {}),
          ...(change.request.clear ?? []),
          ...(change.request.addTags?.length || change.request.removeTags?.length ? ["tags"] : [])
        ].join(",")
      }
    case TaskChangeType.STATUS:
      return { status: change.request.status }
    case TaskChangeType.DELETE:
    case TaskChangeType.RESTORE:
      return {}
  }
}

/** The API's task changes, as TaxaClient makes them. */
export interface TaskChangesApi {
  updateTask: (ref: string, request: UpdateTaskRequest, ifMatch?: Version) => Promise<Task>
  changeStatus: (ref: string, request: ChangeStatusRequest, ifMatch?: Version) => Promise<Task>
  deleteTask: (ref: string, ifMatch?: Version) => Promise<Task>
  restoreTask: (ref: string) => Promise<Task>
}

/** Where each change made is noted, so it can be undone. */
export interface ChangeHistory {
  recordChange: (task: Task, change: TaskChange) => void
}

export interface TaskChangesState {
  /** Why a task's last change didn't happen, by task, until its next change or the next page. */
  problems: Readonly<Partial<Record<TaskId, string>>>
}

export interface TaskChangesActions {
  /** Makes the change, after any still going to the same task; the task as it then is, or undefined if refused. */
  change: (task: Task, change: TaskChange) => Promise<Task | undefined>
  clearProblems: () => void
}

/**
 * Every change the app makes to tasks. Changes to one task go one at a time,
 * each based on the latest version the page has seen, so none silently
 * overwrites one it hasn't; a refused change leaves a problem to show.
 */
export class TaskChangesService extends AbstractService<TaskChangesState> implements TaskChangesActions {
  readonly #api: TaskChangesApi
  readonly #cache: TaskCache
  readonly #analytics: Analytics
  readonly #logger: Logger<WebLogCode>
  readonly #history: ChangeHistory
  /** Each task's latest change, which its next one waits for. */
  readonly #queues = new Map<TaskId, Promise<unknown>>()

  constructor(
    api: TaskChangesApi,
    cache: TaskCache,
    analytics: Analytics,
    logger: Logger<WebLogCode>,
    history: ChangeHistory
  ) {
    super({ problems: {} })
    this.#history = history
    this.#api = api
    this.#cache = cache
    this.#analytics = analytics
    this.#logger = logger
  }

  readonly change = (task: Task, change: TaskChange): Promise<Task | undefined> => {
    this.#setProblem(task.id, undefined)
    const made = (this.#queues.get(task.id) ?? Promise.resolve()).then(() => this.#make(task, change))
    this.#queues.set(task.id, made)
    return made
  }

  readonly clearProblems = (): void => this.setState({ problems: {} })

  #setProblem(id: TaskId, problem: string | undefined): void {
    this.updateState((state) => ({ ...state, problems: { ...state.problems, [id]: problem } }))
  }

  /** Never rejects, so a refused change doesn't stop the ones queued behind it. */
  async #make(task: Task, change: TaskChange): Promise<Task | undefined> {
    this.#setProblem(task.id, undefined)
    const base = this.#cache.latest(task.id) ?? task
    try {
      const latest = await this.#send(base, change)
      this.#analytics.track(ANALYTICS_CODES.task.changed, `changed ${latest.ref}`, {
        taskId: latest.id,
        taskRef: latest.ref,
        change: change.type,
        ...changeFields(change)
      })
      if (latest.version !== base.version) this.#history.recordChange(latest, change)
      await this.#cache.show(latest)
      return latest
    } catch (error) {
      this.#logger.warn(LOG_CODES.task.changeRefused, "a change to a task was refused", {
        taskId: task.id,
        change: change.type,
        problem: error instanceof TaxaApiError ? error.problem.type : error instanceof Error ? error.name : typeof error
      })
      if (error instanceof TaxaApiError && error.problem.type === ProblemType.VERSION_CONFLICT) {
        this.#setProblem(task.id, CONFLICT_NOTICE)
        const current = TaskSchema.safeParse(error.problem.current)
        if (current.success) await this.#cache.show(current.data)
        return undefined
      }
      this.#setProblem(task.id, problemMessage(error))
      return undefined
    }
  }

  #send(task: Task, change: TaskChange): Promise<Task> {
    switch (change.type) {
      case TaskChangeType.UPDATE:
        return this.#api.updateTask(task.id, change.request, task.version)
      case TaskChangeType.STATUS:
        return this.#api.changeStatus(task.id, change.request, task.version)
      case TaskChangeType.DELETE:
        return this.#api.deleteTask(task.id, task.version)
      case TaskChangeType.RESTORE:
        return this.#api.restoreTask(task.id)
    }
  }
}

export const TaskChangesContext = createServiceContext<TaskChangesService>()

export const useTaskChanges = (): TaskChangesActions => useService(TaskChangesContext)

/** Why the task's last change didn't happen, if it didn't. */
export const useTaskProblem = (id: TaskId | undefined): string | undefined =>
  useServiceState(useService(TaskChangesContext), (state) => (id === undefined ? undefined : state.problems[id]))
