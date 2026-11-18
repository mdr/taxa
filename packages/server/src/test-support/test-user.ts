import { TaxaClient } from "@taxa/shared/api/taxa-client"
import type { Domain } from "@taxa/shared/domains/domain"
import type { CreateTaskRequest, UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import type { Task, TaskStatus } from "@taxa/shared/tasks/task"

/** Someone using Taxa through its API: a person, or one of their agents. */
export class TestCaller {
  readonly name: string
  readonly client: TaxaClient
  readonly httpUrl: string
  readonly secret: string

  constructor(httpUrl: string, name: string, secret: string, agentContext?: string) {
    this.httpUrl = httpUrl
    this.name = name
    this.secret = secret
    this.client = new TaxaClient({ baseUrl: httpUrl, apiKey: secret, agentContext })
  }

  addTask(title: string, fields: Omit<CreateTaskRequest, "title"> = {}): Promise<Task> {
    return this.client.createTask({ title, ...fields })
  }

  /** Change some of a task's fields: `{ priority: Priority.URGENT }`. */
  changeTask(ref: string, set: UpdateTaskRequest["set"]): Promise<Task> {
    return this.client.updateTask(ref, { set })
  }

  /** Move a task to a status, saying who it's waiting on if given. */
  changeStatus(ref: string, status: TaskStatus, waitingOn?: string): Promise<Task> {
    return this.client.changeStatus(ref, { status, waitingOn })
  }
}

export class TestUser extends TestCaller {
  /** A domain of this person's own. */
  addDomain(name: string, prefix: string): Promise<Domain> {
    return this.client.createDomain({ name, prefix })
  }

  /** An agent of this person's, with a key of its own, saying what it's working on if given. */
  async agent(name: string, agentContext?: string): Promise<TestCaller> {
    const agent = await this.client.createAgent(name)
    const key = await this.client.createKey(`${name}'s key`, agent.id)
    return new TestCaller(this.httpUrl, name, key.secret, agentContext)
  }
}
