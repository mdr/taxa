import { Priority, type Task } from "./task.ts"

const PRIORITY_RANK: Record<Priority, number> = {
  [Priority.URGENT]: 0,
  [Priority.HIGH]: 1,
  [Priority.NORMAL]: 2,
  [Priority.LOW]: 3
}

const byDue = (a: Task, b: Task): number => {
  if (a.due === b.due) return 0
  if (a.due === undefined) return 1
  if (b.due === undefined) return -1
  return a.due < b.due ? -1 : 1
}

/** The order lists show tasks in: most urgent first, then soonest due, then oldest. */
export const compareTasks = (a: Task, b: Task): number =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b) || a.number - b.number
