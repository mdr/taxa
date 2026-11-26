import { MissedDays, missedDaysOf, repeatText } from "@taxa/shared/tasks/repeat"
import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Domain } from "@taxa/shared/domains/domain"
import { actorText } from "@taxa/shared/identity/actor-text"
import { formatEstimate } from "@taxa/shared/tasks/estimate"
import type { Task } from "@taxa/shared/tasks/task"
import { taskHighlights } from "@taxa/shared/tasks/task-highlights"
import { checklistText } from "./checklist-format.ts"
import { ENERGY_TEXT, HORIZON_TEXT, PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"

/** One line per task, references lined up. */
export const taskLines = (tasks: Task[], today: IsoDate): string => {
  if (tasks.length === 0) return "No tasks."
  const width = Math.max(...tasks.map(({ ref }) => ref.length))
  return tasks
    .map((task) => {
      const extra = [...taskHighlights(task, today), ...task.tags.map((tag) => `#${tag}`)]
      return `${task.ref.padEnd(width)}  ${task.title}${extra.length > 0 ? `  (${extra.join(", ")})` : ""}`
    })
    .join("\n")
}

const row = (label: string, value: string | undefined): string[] =>
  value === undefined ? [] : [`${label.padEnd(10)}${value}`]

const day = (date: IsoDate | undefined, today: IsoDate): string | undefined => date && formatDay(date, today)

/** The tasks one is linked to: the one it follows on from, and those it led to. */
export interface FollowOnLinks {
  followsOn: Task | undefined
  ledTo: readonly Task[]
}

const named = (task: Task): string => `${task.ref}  ${task.title}`

/** Its domain, and whether it's still in the Inbox there. */
const domainText = (task: Task, domain: Domain | undefined): string | undefined =>
  domain && `${domain.name}${task.inbox ? ", in your Inbox to sort out" : ""}`

/** Everything about one task. */
export const taskDetail = (
  task: Task,
  domain: Domain | undefined,
  today: IsoDate,
  url: string,
  links: FollowOnLinks = { followsOn: undefined, ledTo: [] }
): string =>
  [
    `${task.ref}  ${task.title}`,
    url,
    "",
    ...row("Status", STATUS_TEXT[task.status]),
    ...row("Domain", domainText(task, domain)),
    ...row("Priority", PRIORITY_TEXT[task.priority]),
    ...row("Due", day(task.due, today)),
    ...row(
      "Scheduled",
      task.scheduled && `${formatDay(task.scheduled, today)}${task.scheduledTime ? ` ${task.scheduledTime}` : ""}`
    ),
    ...row("Starts", day(task.start, today)),
    ...row(
      "Repeats",
      task.repeat &&
        `${repeatText(task.repeat)}; missed days ${missedDaysOf(task.repeat) === MissedDays.SKIP ? "skipped" : "carried over"}`
    ),
    ...row("Estimate", task.estimateMinutes === undefined ? undefined : formatEstimate(task.estimateMinutes)),
    ...row("Energy", task.energy && ENERGY_TEXT[task.energy]),
    ...row("Horizon", task.horizon && HORIZON_TEXT[task.horizon]),
    ...row("Tags", task.tags.length > 0 ? task.tags.join(", ") : undefined),
    ...row("Came from", links.followsOn && named(links.followsOn)),
    ...row("Led to", links.ledTo.length > 0 ? links.ledTo.map(named).join(`\n${" ".repeat(10)}`) : undefined),
    ...row("Working", task.inProgressBy && actorText(task.inProgressBy)),
    ...row("Waiting", task.waitingOn),
    ...row("Follow up", day(task.followUp, today)),
    ...row("Why", task.cancelledReason),
    ...row("Deleted", task.deletedAt && "yes (taxa restore brings it back)"),
    ...row("Version", String(task.version)),
    ...(task.checklist.length > 0 ? ["", checklistText(task.ref, task.checklist)] : []),
    ...(task.notes ? ["", task.notes.trimEnd()] : [])
  ].join("\n")
