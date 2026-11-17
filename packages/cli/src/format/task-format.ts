import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Domain } from "@taxa/shared/domains/domain"
import { actorText } from "@taxa/shared/identity/actor-text"
import { formatEstimate } from "@taxa/shared/tasks/estimate"
import type { Task } from "@taxa/shared/tasks/task"
import { taskHighlights } from "@taxa/shared/tasks/task-highlights"
import { ENERGY_TEXT, PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"

/** One line per task, references lined up. */
export const taskLines = (tasks: Task[], today: IsoDate): string => {
  if (tasks.length === 0) return "No tasks."
  const width = Math.max(...tasks.map(({ ref }) => ref.length))
  return tasks
    .map((task) => {
      const extra = taskHighlights(task, today)
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
    ...row("Domain", task.inbox ? "Inbox" : domain?.name),
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
