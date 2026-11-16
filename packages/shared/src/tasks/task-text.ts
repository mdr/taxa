import { Energy, Priority, TaskStatus } from "./task.ts"

export const STATUS_TEXT: Record<TaskStatus, string> = {
  [TaskStatus.OPEN]: "open",
  [TaskStatus.IN_PROGRESS]: "in progress",
  [TaskStatus.WAITING]: "waiting",
  [TaskStatus.DONE]: "done",
  [TaskStatus.CANCELLED]: "cancelled"
}

export const PRIORITY_TEXT: Record<Priority, string> = {
  [Priority.URGENT]: "urgent",
  [Priority.HIGH]: "high",
  [Priority.NORMAL]: "normal",
  [Priority.LOW]: "low"
}

export const ENERGY_TEXT: Record<Energy, string> = {
  [Energy.LOW]: "low energy",
  [Energy.MEDIUM]: "medium energy",
  [Energy.HIGH]: "high energy"
}
