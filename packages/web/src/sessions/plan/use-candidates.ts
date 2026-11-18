import type { Task } from "@taxa/shared/tasks/task"
import { When } from "@taxa/shared/tasks/when"
import { useTasks } from "../../tasks/task-queries.ts"
import { todayFirst } from "./suggestions.ts"

/** The tasks a session can take: today's first, in the order planned, then the rest; not asked for while `enabled` is false. */
export const useSessionCandidates = (enabled = true): Task[] => {
  const all = useTasks({}, enabled)
  const today = useTasks({ when: When.TODAY }, enabled)
  return todayFirst(today.data ?? [], all.data ?? [])
}
