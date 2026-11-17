import { Priority, TaskStatus, type Task } from "./task.ts"

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

const started = (task: Task): number => (task.status === TaskStatus.IN_PROGRESS ? 0 : 1)

/** The order lists show tasks in: those in progress first, then most urgent, then soonest due, then oldest. */
export const compareTasks = (a: Task, b: Task): number =>
  started(a) - started(b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b) || a.number - b.number
