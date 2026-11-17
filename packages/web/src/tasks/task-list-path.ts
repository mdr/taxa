import type { Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"

/** Where a task is listed: its domain, or the Inbox. */
export const taskListPath = (task: Task | undefined, domains: readonly Domain[] | undefined): string => {
  const domain = task && !task.inbox ? domains?.find(({ id }) => id === task.domainId) : undefined
  return domain ? `/domains/${domain.prefix}` : "/"
}
