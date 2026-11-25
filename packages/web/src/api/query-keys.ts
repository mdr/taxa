import type { ListTasksQuery } from "@taxa/shared/tasks/task-requests"

export const queryKeys = {
  domains: ["domains"],
  me: ["me"],
  /** Every list of tasks, whatever its query. */
  allTasks: ["tasks"],
  tasks: (query: ListTasksQuery): unknown[] => ["tasks", query],
  /** Every task shown on its own, whatever it was asked for by. */
  allTask: ["task"],
  task: (ref: string): unknown[] => ["task", ref],
  tags: ["tags"],
  allActivity: ["activity"],
  comments: (taskId: string): unknown[] => ["comments", taskId],
  activity: (ref: string): unknown[] => ["activity", ref],
  /** Every session, the current one included. */
  allSessions: ["session"],
  currentSession: ["session", "current"],
  session: (id: string): unknown[] => ["session", id]
}
