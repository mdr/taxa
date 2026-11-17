import { INBOX_PREFIX, type Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"
import type { UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"

/** The choice that stands for the Inbox: no domain can have its prefix. */
export const INBOX_CHOICE: string = INBOX_PREFIX

/** Where a task is, as a choice: the Inbox, or its domain's prefix. */
export const filingChoice = (task: Task, domains: readonly Domain[]): string =>
  task.inbox ? INBOX_CHOICE : (domains.find(({ id }) => id === task.domainId)?.prefix ?? "")

/** The change that puts a task where it was chosen to go. */
export const filingRequest = (choice: string): UpdateTaskRequest =>
  choice === INBOX_CHOICE ? { set: { inbox: true } } : { set: { domain: choice } }
