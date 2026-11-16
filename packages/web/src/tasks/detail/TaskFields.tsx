import { formatDay } from "@taxa/shared/dates/date-format"
import type { Domain } from "@taxa/shared/domains/domain"
import { actorText } from "@taxa/shared/identity/actor-text"
import { formatEstimate, parseEstimate } from "@taxa/shared/tasks/estimate"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { Energy, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ENERGY_TEXT, PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { useState } from "react"
import styles from "./TaskFields.module.css"
import { taskFieldsTestIds } from "./TaskFieldsTestIds.ts"
import { useToday } from "../../dates/use-today.ts"
import { TaskChangeType, type TaskChange } from "../use-task-changes.ts"

interface TaskFieldsProps {
  task: Task
  domains: Domain[]
  change: (change: TaskChange) => void
}

export const TaskFields = ({ task, domains, change }: TaskFieldsProps) => {
  const today = useToday()
  const [estimate, setEstimate] = useState(
    task.estimateMinutes === undefined ? "" : formatEstimate(task.estimateMinutes)
  )
  const [estimateProblem, setEstimateProblem] = useState(false)
  const setOrClear = (field: ClearableField, value: string | number | undefined) =>
    change({
      type: TaskChangeType.UPDATE,
      request: value === undefined || value === "" ? { clear: [field] } : { set: { [field]: value } }
    })
  const saveEstimate = () => {
    if (estimate.trim() === "") {
      if (task.estimateMinutes !== undefined) setOrClear(ClearableField.ESTIMATE_MINUTES, undefined)
      return
    }
    const minutes = parseEstimate(estimate)
    setEstimateProblem(minutes === undefined)
    if (minutes !== undefined && minutes !== task.estimateMinutes) setOrClear(ClearableField.ESTIMATE_MINUTES, minutes)
  }
  return (
    <div className={styles.fields}>
      <label className={styles.field}>
        Status
        <select
          value={task.status}
          onChange={(event) =>
            change({ type: TaskChangeType.STATUS, request: { status: event.target.value as TaskStatus } })
          }
          data-testid={taskFieldsTestIds.status}
        >
          {Object.values(TaskStatus).map((status) => (
            <option key={status} value={status}>
              {STATUS_TEXT[status]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Domain
        <select
          value={domains.find(({ id }) => id === task.domainId)?.prefix ?? ""}
          onChange={(event) =>
            change({ type: TaskChangeType.UPDATE, request: { set: { domain: event.target.value } } })
          }
          data-testid={taskFieldsTestIds.domain}
        >
          {domains.map(({ id, name, prefix }) => (
            <option key={id} value={prefix}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Priority
        <select
          value={task.priority}
          onChange={(event) =>
            change({ type: TaskChangeType.UPDATE, request: { set: { priority: event.target.value as Priority } } })
          }
          data-testid={taskFieldsTestIds.priority}
        >
          {Object.values(Priority).map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_TEXT[priority]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Due
        <input
          type="date"
          value={task.due ?? ""}
          onChange={(event) => setOrClear(ClearableField.DUE, event.target.value)}
          data-testid={taskFieldsTestIds.due}
        />
      </label>
      <label className={styles.field}>
        Scheduled
        <input
          type="date"
          value={task.scheduled ?? ""}
          onChange={(event) => setOrClear(ClearableField.SCHEDULED, event.target.value)}
          data-testid={taskFieldsTestIds.scheduled}
        />
      </label>
      <label className={styles.field}>
        At
        <input
          type="time"
          value={task.scheduledTime ?? ""}
          onChange={(event) => setOrClear(ClearableField.SCHEDULED_TIME, event.target.value)}
          data-testid={taskFieldsTestIds.scheduledTime}
        />
      </label>
      <label className={styles.field}>
        Starts
        <input
          type="date"
          value={task.start ?? ""}
          onChange={(event) => setOrClear(ClearableField.START, event.target.value)}
          data-testid={taskFieldsTestIds.start}
        />
      </label>
      <label className={styles.field}>
        Estimate
        <input
          value={estimate}
          placeholder="30m, 1h30m"
          onChange={(event) => setEstimate(event.target.value)}
          onBlur={saveEstimate}
          aria-invalid={estimateProblem}
          data-testid={taskFieldsTestIds.estimate}
        />
      </label>
      <label className={styles.field}>
        Energy
        <select
          value={task.energy ?? ""}
          onChange={(event) => setOrClear(ClearableField.ENERGY, event.target.value)}
          data-testid={taskFieldsTestIds.energy}
        >
          <option value="">any</option>
          {Object.values(Energy).map((energy) => (
            <option key={energy} value={energy}>
              {ENERGY_TEXT[energy]}
            </option>
          ))}
        </select>
      </label>
      {task.inProgressBy && (
        <p className={styles.note} data-testid={taskFieldsTestIds.inProgressBy}>
          {actorText(task.inProgressBy)} is working on this.
        </p>
      )}
      {task.status === TaskStatus.WAITING && (
        <p className={styles.note} data-testid={taskFieldsTestIds.waiting}>
          Waiting{task.waitingOn ? ` on ${task.waitingOn}` : ""}
          {task.followUp ? `; follow up ${formatDay(task.followUp, today)}` : ""}.
        </p>
      )}
      {task.cancelledReason && (
        <p className={styles.note} data-testid={taskFieldsTestIds.cancelledReason}>
          Cancelled: {task.cancelledReason}
        </p>
      )}
    </div>
  )
}
