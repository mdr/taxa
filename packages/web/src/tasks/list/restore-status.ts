import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { ChangeStatusRequest } from "@taxa/shared/tasks/task-requests"

/** What puts a task back to the status it had, with what went with it: what it was waiting on, or why it was cancelled. */
export const restoringStatus = (before: Task): ChangeStatusRequest => {
  switch (before.status) {
    case TaskStatus.WAITING:
      return { status: before.status, waitingOn: before.waitingOn, followUp: before.followUp }
    case TaskStatus.CANCELLED:
      return { status: before.status, reason: before.cancelledReason }
    case TaskStatus.OPEN:
    case TaskStatus.IN_PROGRESS:
    case TaskStatus.DONE:
      return { status: before.status }
  }
}
