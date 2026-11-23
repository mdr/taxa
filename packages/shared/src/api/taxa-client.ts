import { DAY_PLANS_PATH, DayPlanSchema, type DayPlan, type SetDayPlanRequest } from "../days/day-plan.ts"
import { BIN_PATH, PurgedSchema } from "../tasks/bin.ts"
import type { IsoDate } from "../dates/plain-date.ts"
import type { AgentId, ApiKeyId, SessionId } from "../ids.ts"
import type { Version } from "../units.ts"
import { z } from "zod"
import { ActivitySchema, type Activity } from "../activity/activity.ts"
import { DOMAINS_PATH, DomainSchema, type CreateDomainRequest, type Domain } from "../domains/domain.ts"
import { AGENT_CONTEXT_HEADER, ME_PATH, MeSchema, type Me } from "../identity/actor.ts"
import {
  AGENTS_PATH,
  AgentSchema,
  ApiKeySchema,
  CreatedKeySchema,
  KEYS_PATH,
  type Agent,
  type ApiKey,
  type CreatedKey
} from "../identity/agent.ts"
import {
  type ChangeStatusRequest,
  type CreateTaskRequest,
  type ListTasksQuery,
  type UpdateTaskRequest
} from "../tasks/task-requests.ts"
import { TASKS_PATH, TaskSchema, type Task } from "../tasks/task.ts"
import { TAGS_PATH, TagSummarySchema, type RenameTagRequest, type TagSummary } from "../tasks/tags.ts"
import {
  CURRENT_SESSION_PATH,
  CurrentSessionSchema,
  SESSIONS_PATH,
  SessionSchema,
  type CreateSessionRequest,
  type Session,
  type UpdateSessionRequest
} from "../sessions/session.ts"
import { HEALTH_PATH, HealthSchema, type Health } from "./health.ts"
import { definedFields } from "../objects.ts"
import { IDEMPOTENCY_KEY_HEADER, ProblemSchema, ProblemType, type Problem } from "./problem.ts"

export interface TaxaClientOptions {
  /** Where the server is; "" for the page's own origin. */
  baseUrl: string
  apiKey?: string
  /** For agents: what they're working on, recorded with their changes. */
  agentContext?: string
  fetch?: typeof fetch
}

/** The API answered with a problem, or not at all. */
export class TaxaApiError extends Error {
  readonly status: number
  readonly problem: Problem

  constructor(status: number, problem: Problem) {
    super(problem.message)
    this.status = status
    this.problem = problem
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  ifMatch?: Version
  idempotencyKey?: string
}

const ListSchema = <T extends z.ZodType>(item: T): z.ZodObject<{ items: z.ZodArray<T> }> =>
  z.object({ items: z.array(item) })

/** The Taxa HTTP API, typed: what the CLI, the web app and the tests talk through. */
export class TaxaClient {
  readonly #options: TaxaClientOptions

  constructor(options: TaxaClientOptions) {
    this.#options = options
  }

  health(): Promise<Health> {
    return this.#request(HealthSchema, HEALTH_PATH)
  }

  me(): Promise<Me> {
    return this.#request(MeSchema, ME_PATH)
  }

  async domains(): Promise<Domain[]> {
    return (await this.#request(ListSchema(DomainSchema), DOMAINS_PATH)).items
  }

  createDomain(request: CreateDomainRequest, idempotencyKey?: string): Promise<Domain> {
    return this.#request(DomainSchema, DOMAINS_PATH, {
      method: "POST",
      body: request,
      idempotencyKey
    })
  }

  async tasks(query: ListTasksQuery = {}): Promise<Task[]> {
    const search = new URLSearchParams(definedFields(query))
    const suffix = search.size > 0 ? `?${search}` : ""
    return (await this.#request(ListSchema(TaskSchema), `${TASKS_PATH}${suffix}`)).items
  }

  task(ref: string): Promise<Task> {
    return this.#request(TaskSchema, taskPath(ref))
  }

  createTask(request: CreateTaskRequest, idempotencyKey?: string): Promise<Task> {
    return this.#request(TaskSchema, TASKS_PATH, {
      method: "POST",
      body: request,
      idempotencyKey
    })
  }

  /** `ifMatch`: the version you last saw; the change is refused if the task has moved on since. */
  updateTask(ref: string, request: UpdateTaskRequest, ifMatch?: Version): Promise<Task> {
    return this.#request(TaskSchema, taskPath(ref), { method: "PATCH", body: request, ifMatch })
  }

  changeStatus(ref: string, request: ChangeStatusRequest, ifMatch?: Version): Promise<Task> {
    return this.#request(TaskSchema, `${taskPath(ref)}/status`, { method: "POST", body: request, ifMatch })
  }

  deleteTask(ref: string, ifMatch?: Version): Promise<Task> {
    return this.#request(TaskSchema, taskPath(ref), { method: "DELETE", ifMatch })
  }

  restoreTask(ref: string): Promise<Task> {
    return this.#request(TaskSchema, `${taskPath(ref)}/restore`, { method: "POST" })
  }

  /** Deletes a task in the bin for good. */
  async purgeTask(ref: string): Promise<void> {
    await this.#request(PurgedSchema, `${taskPath(ref)}/purge`, { method: "POST" })
  }

  /** Deletes every task in the bin for good; how many. */
  async emptyBin(): Promise<number> {
    return (await this.#request(PurgedSchema, `${BIN_PATH}/empty`, { method: "POST" })).purged
  }

  /** Takes back the change that brought a task to `version`; undoing an undo redoes it. */
  undoTask(ref: string, version: Version): Promise<Task> {
    return this.#request(TaskSchema, `${taskPath(ref)}/undo`, { method: "POST", body: { version } })
  }

  async activity(ref: string): Promise<Activity[]> {
    return (await this.#request(ListSchema(ActivitySchema), `${taskPath(ref)}/activity`)).items
  }

  /** The tags on tasks you can see, by name. */
  async tags(): Promise<TagSummary[]> {
    return (await this.#request(ListSchema(TagSummarySchema), TAGS_PATH)).items
  }

  /** Renames a tag on every task you can see that has it. */
  renameTag(request: RenameTagRequest): Promise<{ renamed: number }> {
    return this.#request(z.object({ renamed: z.number() }), `${TAGS_PATH}/rename`, { method: "POST", body: request })
  }

  /** Your session under way, if there is one. */
  async currentSession(): Promise<Session | undefined> {
    return (await this.#request(CurrentSessionSchema, CURRENT_SESSION_PATH)).session
  }

  session(id: SessionId): Promise<Session> {
    return this.#request(SessionSchema, sessionPath(id))
  }

  createSession(request: CreateSessionRequest, idempotencyKey?: string): Promise<Session> {
    return this.#request(SessionSchema, SESSIONS_PATH, { method: "POST", body: request, idempotencyKey })
  }

  updateSession(id: SessionId, request: UpdateSessionRequest, ifMatch?: Version): Promise<Session> {
    return this.#request(SessionSchema, sessionPath(id), { method: "PATCH", body: request, ifMatch })
  }

  /** The order you mean to do a day's tasks in. */
  dayPlan(date: IsoDate): Promise<DayPlan> {
    return this.#request(DayPlanSchema, dayPlanPath(date))
  }

  setDayPlan(date: IsoDate, request: SetDayPlanRequest): Promise<DayPlan> {
    return this.#request(DayPlanSchema, dayPlanPath(date), { method: "PUT", body: request })
  }

  async agents(): Promise<Agent[]> {
    return (await this.#request(ListSchema(AgentSchema), AGENTS_PATH)).items
  }

  createAgent(name: string): Promise<Agent> {
    return this.#request(AgentSchema, AGENTS_PATH, { method: "POST", body: { name } })
  }

  async keys(): Promise<ApiKey[]> {
    return (await this.#request(ListSchema(ApiKeySchema), KEYS_PATH)).items
  }

  createKey(name: string, agentId?: AgentId): Promise<CreatedKey> {
    return this.#request(CreatedKeySchema, KEYS_PATH, { method: "POST", body: { name, agentId } })
  }

  revokeKey(id: ApiKeyId): Promise<ApiKey> {
    return this.#request(ApiKeySchema, `${KEYS_PATH}/${encodeURIComponent(id)}`, { method: "DELETE" })
  }

  async #request<T extends z.ZodType>(
    schema: T,
    path: string,
    { method = "GET", body, ifMatch, idempotencyKey }: RequestOptions = {}
  ): Promise<z.infer<T>> {
    const { baseUrl, apiKey, agentContext, fetch: fetchFn = fetch } = this.#options
    const headers: Record<string, string> = {}
    if (body !== undefined) headers["content-type"] = "application/json"
    if (apiKey) headers["authorization"] = `Bearer ${apiKey}`
    if (agentContext) headers[AGENT_CONTEXT_HEADER] = agentContext
    if (ifMatch !== undefined) headers["if-match"] = `"${ifMatch}"`
    if (idempotencyKey) headers[IDEMPOTENCY_KEY_HEADER] = idempotencyKey
    const response = await fetchFn(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const json: unknown = await response.json().catch(() => undefined)
    if (response.ok) return schema.parse(json)
    const problem = ProblemSchema.safeParse(json)
    throw new TaxaApiError(
      response.status,
      problem.success
        ? problem.data
        : { type: ProblemType.INVALID_REQUEST, message: `The server answered ${response.status}.` }
    )
  }
}

const taskPath = (ref: string): string => `${TASKS_PATH}/${encodeURIComponent(ref)}`
const dayPlanPath = (date: IsoDate): string => `${DAY_PLANS_PATH}/${date}`

const sessionPath = (id: SessionId): string => `${SESSIONS_PATH}/${encodeURIComponent(id)}`
