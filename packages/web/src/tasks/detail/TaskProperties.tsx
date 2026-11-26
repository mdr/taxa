import { formatDay } from "@taxa/shared/dates/date-format"
import type { Domain } from "@taxa/shared/domains/domain"
import { actorText } from "@taxa/shared/identity/actor-text"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { setOrClear as fieldChange } from "../changes/field-change.ts"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { When, whenOf, whenRequest } from "@taxa/shared/tasks/when"
import { WHEN_ICONS, whenLabel, whenOptions } from "../when/when-choices.tsx"
import { CalendarClock, CalendarDays, EyeOff, SkipForward } from "lucide-react"
import styles from "./TaskProperties.module.css"
import { taskPropertiesTestIds } from "./TaskPropertiesTestIds.ts"
import { ChoiceProperty } from "./properties/ChoiceProperty.tsx"
import { DateProperty, DateTone } from "./properties/DateProperty.tsx"
import { EstimateProperty } from "./properties/EstimateProperty.tsx"
import { RepeatProperty } from "./properties/RepeatProperty.tsx"
import { OccurrenceOutcome } from "@taxa/shared/tasks/repeat"
import { useToday } from "../../dates/use-today.ts"
import { DomainChoice } from "../filing/DomainChoice.tsx"
import { PriorityIcon } from "../PriorityIcon.tsx"
import { StatusIcon } from "../StatusIcon.tsx"
import { capitalised } from "../../ui/capitalised.ts"
import { TaskChangeType, type TaskChange } from "../changes/task-changes-service.ts"
import { TagsProperty } from "../../tags/TagsProperty.tsx"

/** What When can choose for a repeating task, which always has a day it's next for. */
const REPEATING_WHENS: ReadonlySet<string> = new Set([When.TODAY])

/** In the status menu of a repeating task: not this time. */
const SKIP = "SKIP"

interface TaskPropertiesProps {
  task: Task
  domains: Domain[]
  change: (change: TaskChange) => void
}

export const TaskProperties = ({ task, domains, change }: TaskPropertiesProps) => {
  const today = useToday()
  const setOrClear = (field: ClearableField, value: string | number | undefined) => change(fieldChange(field, value))
  const when = whenOf(task, today)
  const WhenIcon = WHEN_ICONS[when]
  const dueTone =
    task.due === undefined || task.due > today ? DateTone.PLAIN : task.due === today ? DateTone.TODAY : DateTone.OVERDUE
  return (
    <div className={styles.properties}>
      <ChoiceProperty
        label="Status"
        testId={taskPropertiesTestIds.status}
        shortcut={{ key: "s", description: "Change status" }}
        value={task.status}
        trigger={
          <>
            <StatusIcon status={task.status} />
            {capitalised(STATUS_TEXT[task.status])}
          </>
        }
        options={[
          // A repeating task is skipped this time, not cancelled.
          ...Object.values(TaskStatus)
            .filter((status) => !(task.repeat && status === TaskStatus.CANCELLED))
            .map((status) => ({
              value: status,
              label: task.repeat && status === TaskStatus.DONE ? "Done this time" : capitalised(STATUS_TEXT[status]),
              icon: <StatusIcon status={status} />
            })),
          ...(task.repeat
            ? [{ value: SKIP, label: "Skip this time", icon: <SkipForward size={15} aria-hidden /> }]
            : [])
        ]}
        onChoose={(status) =>
          change(
            status === SKIP
              ? { type: TaskChangeType.OCCURRENCE, request: { outcome: OccurrenceOutcome.SKIPPED } }
              : { type: TaskChangeType.STATUS, request: { status: status as TaskStatus } }
          )
        }
      />
      <ChoiceProperty
        label="Priority"
        testId={taskPropertiesTestIds.priority}
        shortcut={{ key: "p", description: "Set priority" }}
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
        label="When"
        testId={taskPropertiesTestIds.when}
        shortcut={{ key: "w", description: "Choose when" }}
        value={when}
        empty={when === When.ANY_TIME}
        trigger={
          <>
            <WhenIcon size={15} aria-hidden />
            {when === When.ANY_TIME ? "When" : whenLabel(task, today)}
          </>
        }
        // A day to come is the Scheduled date, just below; a repeating task always has one.
        options={whenOptions(task, today, false).filter(({ value }) => !task.repeat || REPEATING_WHENS.has(value))}
        onChoose={(choice) => change({ type: TaskChangeType.UPDATE, request: whenRequest(choice as When, today) })}
      />
      <RepeatProperty
        repeat={task.repeat}
        from={task.scheduled ?? today}
        testId={taskPropertiesTestIds.repeat}
        shortcut={{ key: "o", description: "Repeat (how often)" }}
        onChange={(repeat) =>
          change({
            type: TaskChangeType.UPDATE,
            request: repeat ? { set: { repeat } } : { clear: [ClearableField.REPEAT] }
          })
        }
      />
      <DomainChoice
        task={task}
        domains={domains}
        testId={taskPropertiesTestIds.domain}
        shortcut={{ key: "m", description: "Move to a domain" }}
        onChoose={(request) => change({ type: TaskChangeType.UPDATE, request })}
      />
      <TagsProperty task={task} change={change} />
      <DateProperty
        label="Due"
        icon={<CalendarClock size={15} aria-hidden />}
        testId={taskPropertiesTestIds.due}
        shortcut={{ key: "d", description: "Set a due date" }}
        value={task.due}
        today={today}
        tone={dueTone}
        onChange={(date) => setOrClear(ClearableField.DUE, date)}
      />
      <DateProperty
        label="Scheduled"
        icon={<CalendarDays size={15} aria-hidden />}
        testId={taskPropertiesTestIds.scheduled}
        shortcut={{ key: "t", description: "Schedule" }}
        value={task.scheduled}
        today={today}
        onChange={(date) =>
          date === undefined
            ? setOrClear(ClearableField.SCHEDULED, date)
            : change({ type: TaskChangeType.UPDATE, request: whenRequest(When.ON_A_DAY, today, date) })
        }
        time={{ value: task.scheduledTime, onChange: (time) => setOrClear(ClearableField.SCHEDULED_TIME, time) }}
      />
      <DateProperty
        label="Hidden until"
        icon={<EyeOff size={15} aria-hidden />}
        testId={taskPropertiesTestIds.start}
        shortcut={{ key: "h", description: "Hide until a date" }}
        value={task.start}
        today={today}
        onChange={(date) => setOrClear(ClearableField.START, date)}
      />
      <EstimateProperty
        minutes={task.estimateMinutes}
        testId={taskPropertiesTestIds.estimate}
        shortcut={{ key: "e", description: "Estimate" }}
        onChange={(minutes) => setOrClear(ClearableField.ESTIMATE_MINUTES, minutes)}
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
