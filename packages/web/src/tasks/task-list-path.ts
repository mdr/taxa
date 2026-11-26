import type { Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"

/** Where a task is listed: the Inbox while it's to be sorted out, else its domain. */
export const taskListPath = (task: Task | undefined, domains: readonly Domain[] | undefined): string => {
  const domain = task === undefined || task.inbox ? undefined : domains?.find(({ id }) => id === task.domainId)
  return domain ? `/domains/${domain.prefix}` : "/"
}
