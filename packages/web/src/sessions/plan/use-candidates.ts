import type { Task } from "@taxa/shared/tasks/task"
import { When } from "@taxa/shared/tasks/when"
import { useMemo } from "react"
import { useTasks } from "../../tasks/task-queries.ts"
import { todayFirst } from "./suggestions.ts"

/**
 * The tasks a session can take: today's first, in the order planned, then
 * the rest; nothing until they've come, and not asked for while `enabled` is false.
 */
export const useSessionCandidates = (enabled = true): Task[] | undefined => {
  const all = useTasks({}, enabled).data
  const today = useTasks({ when: When.TODAY }, enabled).data
  return useMemo(() => (all && today ? todayFirst(today, all) : undefined), [all, today])
}
