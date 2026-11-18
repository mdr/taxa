import { ClearableField } from "@taxa/shared/tasks/task-requests"
import type { Task } from "@taxa/shared/tasks/task"
import type { Minutes } from "@taxa/shared/units"
import { TaskChangeType, useTaskChanges } from "../../tasks/changes/task-changes-service.ts"
import { EstimateProperty } from "../../tasks/detail/properties/EstimateProperty.tsx"

/** The task's own estimate, as on its page: set, changed or cleared here, it's saved to the task. */
export const TaskEstimate = ({
  task,
  testId,
  onEstimated
}: {
  task: Task
  testId: string
  onEstimated?: (task: Task) => void
}) => {
  const { change } = useTaskChanges()
  const estimate = async (minutes: Minutes | undefined) => {
    const saved = await change(task, {
      type: TaskChangeType.UPDATE,
      request:
        minutes === undefined ? { clear: [ClearableField.ESTIMATE_MINUTES] } : { set: { estimateMinutes: minutes } }
    })
    if (saved) onEstimated?.(saved)
  }
  return (
    <EstimateProperty
      minutes={task.estimateMinutes}
      label={`Estimate for ${task.title}`}
      testId={testId}
      onChange={(minutes) => void estimate(minutes)}
    />
  )
}
