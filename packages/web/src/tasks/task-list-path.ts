import type { Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"

/** Where a task is listed: its domain, or the Inbox. */
export const taskListPath = (task: Task | undefined, domains: readonly Domain[] | undefined): string => {
  const domain = task?.domainId === undefined ? undefined : domains?.find(({ id }) => id === task.domainId)
  return domain ? `/domains/${domain.prefix}` : "/"
}
