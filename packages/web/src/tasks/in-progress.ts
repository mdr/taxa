import { TaskStatus } from "@taxa/shared/tasks/task"

export const START_OR_STOP = "Start, or stop working on it"

export const IN_PROGRESS_PATH = "/in-progress"

/** What starting or stopping does to a task: starts it, or stops it if it's in progress; nothing once it's finished. */
export const startedOrStopped = (status: TaskStatus): TaskStatus | undefined => {
  switch (status) {
    case TaskStatus.IN_PROGRESS:
      return TaskStatus.OPEN
    case TaskStatus.OPEN:
    case TaskStatus.WAITING:
      return TaskStatus.IN_PROGRESS
    case TaskStatus.DONE:
    case TaskStatus.CANCELLED:
      return undefined
  }
}
