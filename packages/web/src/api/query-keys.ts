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
  /** A repeating task's occurrences, as of a version of it: each change to it may record one, or take one back. */
  occurrences: (taskId: string, version: number): unknown[] => ["occurrences", taskId, version],
  activity: (ref: string): unknown[] => ["activity", ref],
  /** Every session, the current one included. */
  allSessions: ["session"],
  currentSession: ["session", "current"],
  session: (id: string): unknown[] => ["session", id]
}
