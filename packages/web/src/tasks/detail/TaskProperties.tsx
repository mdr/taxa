import { formatDay } from "@taxa/shared/dates/date-format"
import type { Domain } from "@taxa/shared/domains/domain"
import { actorText } from "@taxa/shared/identity/actor-text"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { Energy, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ENERGY_TEXT, PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  CalendarClock,
  CalendarDays,
  EyeOff,
  Inbox,
  Zap,
  type LucideIcon
} from "lucide-react"
import styles from "./TaskProperties.module.css"
import { taskPropertiesTestIds } from "./TaskPropertiesTestIds.ts"
import { ChoiceProperty } from "./properties/ChoiceProperty.tsx"
import { DateProperty, DateTone } from "./properties/DateProperty.tsx"
import { EstimateProperty } from "./properties/EstimateProperty.tsx"
import { useToday } from "../../dates/use-today.ts"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import { PriorityIcon } from "../PriorityIcon.tsx"
import { StatusIcon } from "../StatusIcon.tsx"
import { TaskChangeType, type TaskChange } from "../use-task-changes.ts"

const ENERGY_ICONS: Record<Energy, LucideIcon> = {
  [Energy.LOW]: BatteryLow,
  [Energy.MEDIUM]: BatteryMedium,
  [Energy.HIGH]: BatteryFull
}

/** Sentence case for a chip, from the lower-case text the CLI shares. */
const capitalised = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`

interface TaskPropertiesProps {
  task: Task
  domains: Domain[]
  change: (change: TaskChange) => void
}

export const TaskProperties = ({ task, domains, change }: TaskPropertiesProps) => {
  const today = useToday()
  const domain = domains.find(({ id }) => id === task.domainId)
  const setOrClear = (field: ClearableField, value: string | number | undefined) =>
    change({
      type: TaskChangeType.UPDATE,
      request: value === undefined ? { clear: [field] } : { set: { [field]: value } }
    })
  const EnergyIcon = task.energy ? ENERGY_ICONS[task.energy] : Zap
  const dueTone =
    task.due === undefined || task.due > today ? DateTone.PLAIN : task.due === today ? DateTone.TODAY : DateTone.OVERDUE
  return (
    <div className={styles.properties}>
      <ChoiceProperty
        label="Status"
        testId={taskPropertiesTestIds.status}
        value={task.status}
        trigger={
          <>
            <StatusIcon status={task.status} />
            {capitalised(STATUS_TEXT[task.status])}
          </>
        }
        options={Object.values(TaskStatus).map((status) => ({
          value: status,
          label: capitalised(STATUS_TEXT[status]),
          icon: <StatusIcon status={status} />
        }))}
        onChoose={(status) => change({ type: TaskChangeType.STATUS, request: { status: status as TaskStatus } })}
      />
      <ChoiceProperty
        label="Priority"
        testId={taskPropertiesTestIds.priority}
        value={task.priority}
        empty={task.priority === Priority.NORMAL}
        trigger={
          <>
            <PriorityIcon priority={task.priority} />
            {task.priority === Priority.NORMAL ? "Priority" : capitalised(PRIORITY_TEXT[task.priority])}
          </>
        }
        options={Object.values(Priority).map((priority) => ({
          value: priority,
          label: capitalised(PRIORITY_TEXT[priority]),
          icon: <PriorityIcon priority={priority} />
        }))}
        onChoose={(priority) =>
          change({ type: TaskChangeType.UPDATE, request: { set: { priority: priority as Priority } } })
        }
      />
      <ChoiceProperty
        label="Domain"
        testId={taskPropertiesTestIds.domain}
        value={domain?.prefix ?? ""}
        trigger={
          <>
            {domain && <DomainBadge prefix={domain.prefix} />}
            {domain?.name ?? "Domain"}
            {task.inbox && (
              <span className={styles.inbox}>
                <Inbox size={13} aria-hidden /> Inbox
              </span>
            )}
          </>
        }
        options={domains.map(({ name, prefix }) => ({
          value: prefix,
          label: name,
          icon: <DomainBadge prefix={prefix} />
        }))}
        // Choosing a domain files the task, even when it's the one it's in.
        onChoose={(prefix) =>
          change({ type: TaskChangeType.UPDATE, request: { set: { domain: prefix, inbox: false } } })
        }
      />
      <DateProperty
        label="Due"
        icon={<CalendarClock size={15} aria-hidden />}
        testId={taskPropertiesTestIds.due}
        value={task.due}
        today={today}
        tone={dueTone}
        onChange={(date) => setOrClear(ClearableField.DUE, date)}
      />
      <DateProperty
        label="Scheduled"
        icon={<CalendarDays size={15} aria-hidden />}
        testId={taskPropertiesTestIds.scheduled}
        value={task.scheduled}
        today={today}
        onChange={(date) => setOrClear(ClearableField.SCHEDULED, date)}
        time={{ value: task.scheduledTime, onChange: (time) => setOrClear(ClearableField.SCHEDULED_TIME, time) }}
      />
      <DateProperty
        label="Hidden until"
        icon={<EyeOff size={15} aria-hidden />}
        testId={taskPropertiesTestIds.start}
        value={task.start}
        today={today}
        onChange={(date) => setOrClear(ClearableField.START, date)}
      />
      <EstimateProperty
        minutes={task.estimateMinutes}
        testId={taskPropertiesTestIds.estimate}
        onChange={(minutes) => setOrClear(ClearableField.ESTIMATE_MINUTES, minutes)}
      />
      <ChoiceProperty
        label="Energy"
        testId={taskPropertiesTestIds.energy}
        value={task.energy ?? ""}
        empty={task.energy === undefined}
        trigger={
          <>
            <EnergyIcon size={15} aria-hidden />
            {task.energy ? capitalised(ENERGY_TEXT[task.energy]) : "Energy"}
          </>
        }
        options={[
          ...Object.values(Energy).map((energy) => {
            const Icon = ENERGY_ICONS[energy]
            return { value: energy, label: capitalised(ENERGY_TEXT[energy]), icon: <Icon size={15} aria-hidden /> }
          }),
          ...(task.energy ? [{ value: "", label: "Clear", danger: true }] : [])
        ]}
        onChoose={(energy) => setOrClear(ClearableField.ENERGY, energy === "" ? undefined : energy)}
      />
      {task.inProgressBy && (
        <p className={styles.note} data-testid={taskPropertiesTestIds.inProgressBy}>
          <StatusIcon status={TaskStatus.IN_PROGRESS} /> {actorText(task.inProgressBy)} is working on this
        </p>
      )}
      {task.status === TaskStatus.WAITING && (
        <p className={styles.note} data-testid={taskPropertiesTestIds.waiting}>
          <StatusIcon status={TaskStatus.WAITING} />
          Waiting{task.waitingOn ? ` on ${task.waitingOn}` : ""}
          {task.followUp ? `, follow up ${formatDay(task.followUp, today)}` : ""}
        </p>
      )}
      {task.cancelledReason && (
        <p className={styles.note} data-testid={taskPropertiesTestIds.cancelledReason}>
          <StatusIcon status={TaskStatus.CANCELLED} /> Cancelled: {task.cancelledReason}
        </p>
      )}
    </div>
  )
}
