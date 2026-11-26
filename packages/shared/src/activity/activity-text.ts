import { formatDay } from "../dates/date-format.ts"
import { z } from "zod"
import { IsoDateSchema, type IsoDate } from "../dates/plain-date.ts"
import { MissedDays, missedDaysOf, OccurrenceOutcome, RepeatSchema, repeatText } from "../tasks/repeat.ts"
import { actorText } from "../identity/actor-text.ts"
import { formatEstimate } from "../tasks/estimate.ts"
import { Energy, Horizon, Priority, TaskStatus } from "../tasks/task.ts"
import { ENERGY_TEXT, HORIZON_TEXT, PRIORITY_TEXT, STATUS_TEXT } from "../tasks/task-text.ts"
import { ActivityType, type Activity, type FieldChange } from "./activity.ts"
import { checklistPhrase } from "./checklist-phrase.ts"

export interface ActivityContext {
  today: IsoDate
  /** A domain's name from its id, if it's one the reader can see. */
  domainName: (id: string) => string | undefined
}

/** Who did something, and what they did, as a sentence's two halves. */
export interface ActivityParts {
  actor: string
  action: string
}

const isOneOf = <T extends string>(values: Record<string, T>, value: unknown): value is T =>
  Object.values(values).includes(value as T)

/** `Every Monday` as `every Monday`, mid-sentence. */
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1)

const quoted = (value: unknown): string => {
  const text = String(value)
  return `“${text.length > 60 ? `${text.slice(0, 59)}…` : text}”`
}

type Phrase = (change: FieldChange, context: ActivityContext) => string | undefined

const datePhrase =
  (name: string): Phrase =>
  ({ to }, { today }) =>
    typeof to === "string" ? `set ${name} to ${formatDay(to, today)}` : `cleared the ${name} date`

const notesPhrase: Phrase = ({ from, to }) => {
  if (typeof to !== "string" || to === "") return "cleared the notes"
  return from === undefined || from === "" ? "added notes" : "edited the notes"
}

const tagList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === "string") : []

const tagsPhrase: Phrase = ({ from, to }) => {
  const before = tagList(from).map((tag) => tag.toLowerCase())
  const after = tagList(to).map((tag) => tag.toLowerCase())
  const added = tagList(to).filter((tag) => !before.includes(tag.toLowerCase()))
  const removed = tagList(from).filter((tag) => !after.includes(tag.toLowerCase()))
  const parts = [
    ...(added.length ? [`tagged it ${added.join(", ")}`] : []),
    ...(removed.length ? [`took off ${removed.length === 1 ? "the tag" : "the tags"} ${removed.join(", ")}`] : [])
  ]
  return parts.length ? parts.join(" and ") : "renamed a tag"
}

const MISSED_DAYS_ACTION: Record<MissedDays, string> = {
  [MissedDays.SKIP]: "set it to skip missed days",
  [MissedDays.CARRY_OVER]: "set it to carry missed days over"
}

const missedDates = (value: unknown): IsoDate[] => {
  const parsed = z.array(z.object({ date: IsoDateSchema })).safeParse(value)
  return parsed.success ? parsed.data.map(({ date }) => date) : []
}

/** `Mon 5 Jan`, `Mon 5 and Mon 12 Jan`, `3 days, Mon 5 Jan to Wed 7 Jan`. */
const daysText = (dates: readonly IsoDate[], today: IsoDate): string => {
  const [first, last] = [dates[0], dates.at(-1)]
  if (first === undefined || last === undefined) return "the days"
  if (dates.length === 1) return formatDay(first, today)
  if (dates.length === 2) return `${formatDay(first, today)} and ${formatDay(last, today)}`
  return `${dates.length} days, ${formatDay(first, today)} to ${formatDay(last, today)}`
}

/** Days missed, caught up by a change to it: `recorded Mon 5 Jan as missed`, or taken back. */
const missedPhrase: Phrase = ({ from, to }, { today }) =>
  to === undefined
    ? `took back ${daysText(missedDates(from), today)} as missed`
    : `recorded ${daysText(missedDates(to), today)} as missed`

/** What each field's change says. Fields not here are bookkeeping that goes without saying. */
const PHRASES: Record<string, Phrase> = {
  due: datePhrase("due"),
  scheduled: datePhrase("scheduled"),
  start: datePhrase("start"),
  followUp: datePhrase("follow-up"),
  title: ({ from, to }) => (from === undefined ? undefined : `renamed it ${quoted(to)}`),
  notes: notesPhrase,
  priority: ({ to }) => (isOneOf(Priority, to) ? `set priority to ${PRIORITY_TEXT[to]}` : undefined),
  energy: ({ to }) => (isOneOf(Energy, to) ? `marked it ${ENERGY_TEXT[to]}` : "cleared the energy"),
  horizon: ({ from, to }) => {
    if (to === Horizon.SOON) return "put it down for soon"
    if (to === Horizon.SOMEDAY) return "put it off to someday"
    return isOneOf(Horizon, from) ? `took it out of ${HORIZON_TEXT[from]}` : undefined
  },
  estimateMinutes: ({ to }) =>
    typeof to === "number" ? `estimated it at ${formatEstimate(to)}` : "cleared the estimate",
  followsOnId: ({ to }) =>
    typeof to === "string" ? "linked it as a follow-on" : "unlinked it from the task it followed on from",
  tags: tagsPhrase,
  checklist: checklistPhrase,
  repeat: ({ from, to }) => {
    const before = RepeatSchema.safeParse(from)
    const after = RepeatSchema.safeParse(to)
    if (!after.success) return "stopped it repeating"
    const text = repeatText(after.data)
    if (before.success && repeatText(before.data) === text && missedDaysOf(before.data) !== missedDaysOf(after.data))
      return MISSED_DAYS_ACTION[missedDaysOf(after.data)]
    return `set it to repeat ${lowerFirst(text)}`
  },
  missed: missedPhrase,
  scheduledTime: ({ to }) => (typeof to === "string" ? `set the time to ${to}` : "cleared the time"),
  // Filed, or put back to be sorted out again; before Inbox tasks were in domains, a change of domain did both.
  inboxUserId: ({ to }) => (typeof to === "string" ? "put it back in the Inbox" : "filed it"),
  domainId: ({ from, to }, { domainName }) => {
    if (typeof to !== "string") return "put it back in the Inbox"
    const name = domainName(to)
    if (from === undefined) return name ? `filed it in ${name}` : "filed it"
    return name ? `moved it to ${name}` : "moved it to another domain"
  }
}

const phrase = (field: string, change: FieldChange, context: ActivityContext): string | undefined =>
  PHRASES[field]?.(change, context)

const joined = (phrases: string[]): string =>
  phrases.length <= 1 ? (phrases[0] ?? "") : `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`

const STATUS_ACTION: Record<TaskStatus, string> = {
  [TaskStatus.OPEN]: "reopened it",
  [TaskStatus.IN_PROGRESS]: "started it",
  [TaskStatus.WAITING]: `marked it ${STATUS_TEXT[TaskStatus.WAITING]}`,
  [TaskStatus.DONE]: `marked it ${STATUS_TEXT[TaskStatus.DONE]}`,
  [TaskStatus.CANCELLED]: "cancelled it"
}

const statusAction = (changes: Activity["changes"]): string => {
  const to = changes["status"]?.to
  if (!isOneOf(TaskStatus, to)) return "changed the status"
  const waitingOn = changes["waitingOn"]?.to
  const reason = changes["cancelledReason"]?.to
  if (to === TaskStatus.WAITING && typeof waitingOn === "string") return `${STATUS_ACTION[to]} on ${waitingOn}`
  if (to === TaskStatus.CANCELLED && typeof reason === "string") return `${STATUS_ACTION[to]} because ${quoted(reason)}`
  return STATUS_ACTION[to]
}

/** An occurrence as the log keeps it. */
const OccurrenceChangeSchema = z.object({ date: IsoDateSchema, outcome: z.enum(OccurrenceOutcome) })

const OUTCOME_DONE: Record<OccurrenceOutcome, string> = {
  [OccurrenceOutcome.DONE]: "did",
  [OccurrenceOutcome.SKIPPED]: "skipped",
  [OccurrenceOutcome.MISSED]: "missed"
}

/** `did 25 Nov, and moved it to 26 Nov`. */
const occurrenceAction = (changes: Activity["changes"], context: ActivityContext): string => {
  const occurrence = OccurrenceChangeSchema.safeParse(changes["occurrence"]?.to)
  if (!occurrence.success) return "did it"
  const { date, outcome } = occurrence.data
  const next = changes["scheduled"]?.to
  const moved = typeof next === "string" ? `, and moved it to ${formatDay(next, context.today)}` : ""
  const missed = changes["missed"] ? `; ${missedPhrase(changes["missed"], context)}` : ""
  return `${OUTCOME_DONE[outcome]} ${formatDay(date, context.today)}${moved}${missed}`
}

const actionOf = ({ type, changes }: Activity, context: ActivityContext): string => {
  switch (type) {
    case ActivityType.TASK_CREATED:
      return "created this"
    case ActivityType.TASK_DELETED:
      return "deleted this"
    case ActivityType.TASK_RESTORED:
      return "restored this"
    case ActivityType.DOMAIN_CREATED:
      return "created the domain"
    case ActivityType.DOMAIN_DELETED:
      return "deleted the domain"
    case ActivityType.COMMENT_ADDED:
      return "commented"
    case ActivityType.COMMENT_EDITED:
      return "edited a comment"
    case ActivityType.COMMENT_DELETED:
      return "deleted a comment"
    case ActivityType.COMMENT_RESTORED:
      return "restored a comment"
    case ActivityType.TASK_STATUS_CHANGED:
      return statusAction(changes)
    case ActivityType.TASK_OCCURRENCE_RECORDED:
      return occurrenceAction(changes, context)
    case ActivityType.TASK_OCCURRENCE_UNDONE: {
      // Always an undo, which says so: `undid change 4: put it back to Tue 6 Jan`.
      const back = IsoDateSchema.safeParse(changes["scheduled"]?.to)
      const missed = changes["missed"] ? `; ${missedPhrase(changes["missed"], context)}` : ""
      return `${back.success ? `put it back to ${formatDay(back.data, context.today)}` : "put it back"}${missed}`
    }
    case ActivityType.TASK_UPDATED: {
      // An undo can put a status back along with other fields.
      const parts = [
        ...(changes["status"] ? [statusAction(changes)] : []),
        ...Object.entries(changes)
          // Before Inbox tasks were in domains, filing changed both; the domain says it.
          .filter(([field]) => field !== "inboxUserId" || changes["domainId"] === undefined)
          .map(([field, change]) => phrase(field, change, context))
          .filter((text) => text !== undefined)
      ]
      return joined(parts) || "changed it"
    }
  }
}

export const activityParts = (activity: Activity, context: ActivityContext): ActivityParts => {
  const action = actionOf(activity, context)
  return {
    actor: actorText(activity.actor),
    action: activity.undoesVersion === undefined ? action : `undid change ${activity.undoesVersion}: ${action}`
  }
}

/** `Matt set due to Fri 9 Jan and set priority to high`. */
export const activityText = (activity: Activity, context: ActivityContext): string => {
  const { actor, action } = activityParts(activity, context)
  return `${actor} ${action}`
}
