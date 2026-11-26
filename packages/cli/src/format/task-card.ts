import type { Comment } from "@taxa/shared/comments/comment"
import { formatDay, formatNearDay } from "@taxa/shared/dates/date-format"
import type { IsoDate, TimeZone } from "@taxa/shared/dates/plain-date"
import type { Domain } from "@taxa/shared/domains/domain"
import { actorText } from "@taxa/shared/identity/actor-text"
import { checklistProgress, progressText, type ChecklistItem } from "@taxa/shared/tasks/checklist"
import { formatEstimate } from "@taxa/shared/tasks/estimate"
import { MissedDays, missedDaysOf, repeatText } from "@taxa/shared/tasks/repeat"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { TaskRef } from "@taxa/shared/tasks/task-ref"
import { HORIZON_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import type { FollowOnLinks } from "./task-format.ts"
import { localTime } from "./local-time.ts"
import { markdownText } from "./markdown-format.ts"
import { cut, wrap, type Style } from "./style.ts"
import { mark } from "./task-groups.ts"
import { taskUrl } from "./task-url.ts"

/** How wide the checklist's bar is drawn. */
const BAR = 24

const STATUS_COLOUR: Record<TaskStatus, keyof Pick<Style, "green" | "amber" | "violet" | "dim">> = {
  [TaskStatus.DONE]: "green",
  [TaskStatus.IN_PROGRESS]: "amber",
  [TaskStatus.WAITING]: "violet",
  [TaskStatus.CANCELLED]: "dim",
  [TaskStatus.OPEN]: "dim"
}

export interface CardContext {
  today: IsoDate
  timeZone: TimeZone
  web: string
  style: Style
}

const refLink = (ref: TaskRef, { web, style }: CardContext): string => style.link(taskUrl(web, ref), style.dim(ref))

/** Its status, who's on it, where it is, how pressing, and its tags: one line. */
const factsLine = (task: Task, domain: Domain | undefined, { style }: CardContext): string => {
  const status = style[STATUS_COLOUR[task.status]](`${mark(task, style)} ${STATUS_TEXT[task.status]}`)
  const by = task.inProgressBy ? ` ${style.dim("by")} ${actorText(task.inProgressBy)}` : ""
  const on = task.waitingOn ? ` ${style.dim("on")} ${task.waitingOn}` : ""
  const priority =
    task.priority === Priority.URGENT
      ? style.red("‼ urgent")
      : task.priority === Priority.HIGH
        ? style.orange("! high")
        : task.priority === Priority.LOW
          ? style.dim("low")
          : undefined
  return [
    `${status}${by}${on}`,
    ...(domain ? [`${domain.name}${task.inbox ? `, ${style.cyan("in your Inbox")}` : ""}`] : []),
    ...(priority ? [priority] : []),
    ...task.tags.map((tag) => style.cyan(`#${tag}`))
  ].join(` ${style.dim("·")} `)
}

const dueText = (due: IsoDate, today: IsoDate, style: Style): string => {
  if (due < today) return style.red(`overdue, due ${formatDay(due, today)}`)
  return due === today ? style.amber("due today") : `due ${formatNearDay(due, today)}`
}

/** When it's planned for, in green if today. */
const plannedText = (task: Task, today: IsoDate, style: Style): string[] => {
  if (!task.scheduled) return []
  const day = task.scheduled === today ? style.green("today") : formatNearDay(task.scheduled, today)
  return [`${style.dim("planned")} ${day}${task.scheduledTime ? ` ${task.scheduledTime}` : ""}`]
}

/** How it repeats, and what happens to days missed. */
const repeatsLine = (task: Task, style: Style): string[] => {
  if (!task.repeat) return []
  const missed = missedDaysOf(task.repeat) === MissedDays.SKIP ? "skipped" : "carried over"
  return [`${style.dim("repeats")} ${repeatText(task.repeat)}${style.dim(`, missed days ${missed}`)}`]
}

/** When it's planned and due, and how it repeats: a line each, if any. */
const whenLine = (task: Task, { today, style }: CardContext): string[] => {
  const parts = [
    ...plannedText(task, today, style),
    ...(task.due ? [dueText(task.due, today, style)] : []),
    ...(task.horizon && !task.scheduled ? [HORIZON_TEXT[task.horizon]] : []),
    ...(task.start && task.start > today ? [`${style.dim("starts")} ${formatNearDay(task.start, today)}`] : []),
    ...(task.estimateMinutes === undefined ? [] : [`${style.dim("about")} ${formatEstimate(task.estimateMinutes)}`]),
    ...(task.followUp ? [`${style.dim("follow up")} ${formatNearDay(task.followUp, today)}`] : [])
  ]
  return [...(parts.length > 0 ? [parts.join(` ${style.dim("·")} `)] : []), ...repeatsLine(task, style)]
}

/** The tasks it came from and led to, why it was cancelled, and whether it's in the bin. */
const linkLines = (task: Task, links: FollowOnLinks, card: CardContext): string[] => {
  const { style } = card
  return [
    ...(links.followsOn ? [`${style.dim("from")} ${refLink(links.followsOn.ref, card)} ${links.followsOn.title}`] : []),
    ...links.ledTo.map((next) => `${style.dim("led to")} ${refLink(next.ref, card)} ${next.title}`),
    ...(task.cancelledReason ? [`${style.dim("why")} ${task.cancelledReason}`] : []),
    ...(task.deletedAt ? [style.red("In the bin: taxa restore brings it back")] : [])
  ]
}

/** How far through, as a bar. */
const progressBar = (checklist: readonly ChecklistItem[], style: Style): string => {
  const progress = checklistProgress(checklist)
  const filled = Math.round((progress.done / Math.max(progress.total, 1)) * BAR)
  return `${style.green("━".repeat(filled))}${style.dim("─".repeat(BAR - filled))} ${style.dim(progressText(progress))}`
}

/** Its checklist: a bar, then each item numbered as `taxa check` takes them, ticked ones dimmed. */
const checklistLines = (checklist: readonly ChecklistItem[], card: CardContext): string[] => {
  const { style } = card
  if (checklist.length === 0) return []
  const width = String(checklist.length).length
  const room = style.columns === undefined ? undefined : style.columns - width - 5
  return [
    "",
    `${style.bold("Checklist")}  ${progressBar(checklist, style)}`,
    ...checklist.map(({ text, done, task }, index) => {
      const number = style.dim(String(index + 1).padStart(width))
      const made = task ? `  ${style.dim("→")} ${refLink(task.ref, card)}` : ""
      const shown = room === undefined ? text : cut(text, room - (task ? task.ref.length + 4 : 0))
      return `  ${number} ${done ? `${style.green("✓")} ${style.dim(shown)}` : `${style.dim("☐")} ${shown}`}${made}`
    })
  ]
}

/** When, in the reader's time: "today 12:15", or the day and time. */
const when = (at: string, { today, timeZone }: CardContext): string => {
  const [date = "", time = ""] = localTime(at, timeZone).split(" ")
  return `${formatNearDay(date, today)} ${time}`
}

/** The latest comment, with how to see the rest. */
const commentLines = (comments: readonly Comment[], ref: string, card: CardContext): string[] => {
  const { style } = card
  const latest = comments.at(-1)
  if (!latest) return []
  const more = comments.length > 1 ? style.dim(` of ${comments.length} · taxa comments ${ref} for all`) : ""
  return [
    "",
    `${style.bold("Latest comment")}${more}`,
    `  ${style.violet(actorText(latest.author))} ${style.dim(`· ${when(latest.createdAt, card)}${latest.editedAt ? " · edited" : ""}`)}`,
    ...latest.body
      .trimEnd()
      .split("\n")
      .map((line) => (line === "" ? "" : `  ${wrap(line, style.columns, "  ")}`))
  ]
}

/**
 * Everything about a task, for a person at a terminal: the title in bold,
 * its facts on a line under it rather than a table of labels, the checklist
 * as a bar and ticks, the notes drawn from their Markdown, and the latest
 * comment. What's rarely wanted, such as its version, is left to --json.
 */
export const taskCard = (
  task: Task,
  domain: Domain | undefined,
  links: FollowOnLinks,
  comments: readonly Comment[],
  card: CardContext
): string => {
  const { style } = card
  return [
    `${refLink(task.ref, card)}  ${style.bold(task.title)}`,
    factsLine(task, domain, card),
    ...whenLine(task, card),
    ...linkLines(task, links, card),
    ...checklistLines(task.checklist, card),
    ...(task.notes ? ["", style.bold("Notes"), markdownText(task.notes, style)] : []),
    ...commentLines(comments, task.ref, card)
  ].join("\n")
}
