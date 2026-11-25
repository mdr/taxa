import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { OccurrenceOutcome } from "@taxa/shared/tasks/repeat"
import { STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { TaskChangeType, type TaskChange } from "../tasks/changes/task-changes-service.ts"

const statusLabel = (status: TaskStatus, ref: string): string => {
  switch (status) {
    case TaskStatus.OPEN:
      return `Reopened ${ref}`
    case TaskStatus.IN_PROGRESS:
      return `Started ${ref}`
    case TaskStatus.WAITING:
    case TaskStatus.DONE:
      return `Marked ${ref} ${STATUS_TEXT[status]}`
    case TaskStatus.CANCELLED:
      return `Cancelled ${ref}`
  }
}

/** What a change did, in a few words, for the notice that it's been undone: `Marked H-3 done`. */
export const changeLabel = (change: TaskChange, task: Task): string => {
  switch (change.type) {
    case TaskChangeType.STATUS:
      // Done, a repeating task is done this time, and stays open.
      return task.repeat && change.request.status === TaskStatus.DONE
        ? `Did ${task.ref}`
        : statusLabel(change.request.status, task.ref)
    case TaskChangeType.OCCURRENCE:
      return change.request.outcome === OccurrenceOutcome.DONE ? `Did ${task.ref}` : `Skipped ${task.ref}`
    case TaskChangeType.DELETE:
      return `Deleted ${task.ref}`
    case TaskChangeType.RESTORE:
      return `Restored ${task.ref}`
    case TaskChangeType.UPDATE: {
      const { set = {}, addTags = [], removeTags = [] } = change.request
      if (set.title !== undefined) return `Renamed ${task.ref}`
      if (set.domain !== undefined || set.inbox !== undefined) return `Moved ${task.ref}`
      if (addTags.length > 0 || removeTags.length > 0) return `Changed the tags on ${task.ref}`
      return `Changed ${task.ref}`
    }
  }
}

/** For a task added: `Added H-3`. */
export const addedLabel = (task: Task): string => `Added ${task.ref}`

/** For a change undone from its task's history, whatever it was: `Changed H-3`. */
export const changedLabel = (task: Task): string => `Changed ${task.ref}`
