import type { ListTasksQuery } from "@taxa/shared/tasks/task-requests"

export const queryKeys = {
  domains: ["domains"],
  me: ["me"],
  /** Every list of tasks, whatever its query. */
  allTasks: ["tasks"],
  tasks: (query: ListTasksQuery): unknown[] => ["tasks", query],
  task: (ref: string): unknown[] => ["task", ref],
  allActivity: ["activity"],
  activity: (ref: string): unknown[] => ["activity", ref]
}
