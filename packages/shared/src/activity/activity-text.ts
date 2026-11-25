import { formatDay } from "../dates/date-format.ts"
import type { IsoDate } from "../dates/plain-date.ts"
import { actorText } from "../identity/actor-text.ts"
import { formatEstimate } from "../tasks/estimate.ts"
import { Energy, Horizon, Priority, TaskStatus } from "../tasks/task.ts"
import { ENERGY_TEXT, HORIZON_TEXT, PRIORITY_TEXT, STATUS_TEXT } from "../tasks/task-text.ts"
import { ActivityType, type Activity, type FieldChange } from "./activity.ts"

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
  scheduledTime: ({ to }) => (typeof to === "string" ? `set the time to ${to}` : "cleared the time"),
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
    case ActivityType.TASK_UPDATED: {
      // An undo can put a status back along with other fields.
      const parts = [
        ...(changes["status"] ? [statusAction(changes)] : []),
        ...Object.entries(changes)
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
