import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Domain } from "@taxa/shared/domains/domain"
import type { Actor } from "@taxa/shared/identity/actor"
import { formatEstimate } from "@taxa/shared/tasks/estimate"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ENERGY_TEXT, PRIORITY_TEXT, STATUS_TEXT } from "./task-text.ts"

export const actorText = ({ user, agent, agentContext }: Actor): string => {
  if (!agent) return user.name
  return `${agent.name} for ${user.name}${agentContext ? ` (${agentContext})` : ""}`
}

/** What sets a task apart at a glance: status if not open, priority if not normal, dates. */
const highlights = (task: Task, today: IsoDate): string[] => [
  ...(task.status === TaskStatus.OPEN ? [] : [STATUS_TEXT[task.status]]),
  ...(task.waitingOn ? [`on ${task.waitingOn}`] : []),
  ...(task.priority === Priority.NORMAL ? [] : [PRIORITY_TEXT[task.priority]]),
  ...(task.due ? [`due ${formatDay(task.due, today)}`] : []),
  ...(task.scheduled
    ? [`scheduled ${formatDay(task.scheduled, today)}${task.scheduledTime ? ` ${task.scheduledTime}` : ""}`]
    : []),
  ...(task.inbox ? ["inbox"] : [])
]

/** One line per task, references lined up. */
export const taskLines = (tasks: Task[], today: IsoDate): string => {
  if (tasks.length === 0) return "No tasks."
  const width = Math.max(...tasks.map(({ ref }) => ref.length))
  return tasks
    .map((task) => {
      const extra = highlights(task, today)
      return `${task.ref.padEnd(width)}  ${task.title}${extra.length > 0 ? `  (${extra.join(", ")})` : ""}`
    })
    .join("\n")
}

const row = (label: string, value: string | undefined): string[] =>
  value === undefined ? [] : [`${label.padEnd(10)}${value}`]

const day = (date: IsoDate | undefined, today: IsoDate): string | undefined => date && formatDay(date, today)

/** Everything about one task. */
export const taskDetail = (task: Task, domain: Domain | undefined, today: IsoDate): string =>
  [
    `${task.ref}  ${task.title}`,
    "",
    ...row("Status", STATUS_TEXT[task.status]),
    ...row("Domain", domain && `${domain.name}${task.inbox ? " (Inbox)" : ""}`),
    ...row("Priority", PRIORITY_TEXT[task.priority]),
    ...row("Due", day(task.due, today)),
    ...row(
      "Scheduled",
      task.scheduled && `${formatDay(task.scheduled, today)}${task.scheduledTime ? ` ${task.scheduledTime}` : ""}`
    ),
    ...row("Starts", day(task.start, today)),
    ...row("Estimate", task.estimateMinutes === undefined ? undefined : formatEstimate(task.estimateMinutes)),
    ...row("Energy", task.energy && ENERGY_TEXT[task.energy]),
    ...row("Working", task.inProgressBy && actorText(task.inProgressBy)),
    ...row("Waiting", task.waitingOn),
    ...row("Follow up", day(task.followUp, today)),
    ...row("Why", task.cancelledReason),
    ...row("Deleted", task.deletedAt && "yes (taxa restore brings it back)"),
    ...row("Version", String(task.version)),
    ...(task.notes ? ["", task.notes.trimEnd()] : [])
  ].join("\n")
