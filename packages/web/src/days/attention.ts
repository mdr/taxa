import { Horizon, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"

export interface Attention {
  task: Task
  /** Why: `Soon · urgent`. */
  reason: string
}

/**
 * What isn't planned for today but might want to be, beyond deadlines, which
 * have their own box: urgent and lined up for soon. Not what's waiting on others.
 */
export const needingAttention = (tasks: readonly Task[]): Attention[] =>
  tasks
    .filter(
      (task) => task.status !== TaskStatus.WAITING && task.horizon === Horizon.SOON && task.priority === Priority.URGENT
    )
    .map((task) => ({ task, reason: "Soon · urgent" }))
