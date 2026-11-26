import type { Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"
import type { UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"

/** A task's domain, as a choice: its prefix. */
export const domainChoice = (task: Task, domains: readonly Domain[]): string =>
  domains.find(({ id }) => id === task.domainId)?.prefix ?? ""

/** The change that moves a task to the domain chosen. */
export const movedRequest = (prefix: string): UpdateTaskRequest => ({ set: { domain: prefix } })

/** The change that files a task in the Inbox, sorted out, or puts a filed one back there. */
export const filedRequest = (task: Task): UpdateTaskRequest => ({ set: { inbox: !task.inbox } })
