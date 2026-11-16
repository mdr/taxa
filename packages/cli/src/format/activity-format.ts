import { ActivityType, type Activity, type FieldChange } from "@taxa/shared/activity/activity"
import { Energy, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { actorText } from "./task-format.ts"
import { ENERGY_TEXT, PRIORITY_TEXT, STATUS_TEXT } from "./task-text.ts"

const TYPE_TEXT: Record<ActivityType, string> = {
  [ActivityType.DOMAIN_CREATED]: "created the domain",
  [ActivityType.TASK_CREATED]: "created it",
  [ActivityType.TASK_UPDATED]: "changed",
  [ActivityType.TASK_STATUS_CHANGED]: "changed status",
  [ActivityType.TASK_DELETED]: "deleted it",
  [ActivityType.TASK_RESTORED]: "restored it"
}

const isOneOf = <T extends string>(values: Record<string, T>, value: unknown): value is T =>
  Object.values(values).includes(value as T)

const valueText = (value: unknown): string => {
  if (value === undefined) return "nothing"
  if (isOneOf(TaskStatus, value)) return STATUS_TEXT[value]
  if (isOneOf(Priority, value)) return PRIORITY_TEXT[value]
  if (isOneOf(Energy, value)) return ENERGY_TEXT[value]
  if (typeof value === "string") return JSON.stringify(value.length > 40 ? `${value.slice(0, 39)}…` : value)
  if (typeof value === "object") return "someone"
  return typeof value === "number" || typeof value === "boolean" ? String(value) : "something"
}

const changeText = (field: string, { from, to }: FieldChange): string =>
  `${field} ${valueText(from)} → ${valueText(to)}`

/** `2026-01-05 09:00` in the reader's time zone. */
const when = (at: string, timeZone: string): string =>
  new Date(at).toLocaleString("sv-SE", { timeZone, dateStyle: "short", timeStyle: "short" })

/** One line per change, oldest first. */
export const activityLines = (activity: Activity[], timeZone: string): string =>
  activity
    .map(({ at, actor, type, changes }) => {
      const fields =
        type === ActivityType.TASK_CREATED
          ? []
          : Object.entries(changes).map(([field, change]) => changeText(field, change))
      return `${when(at, timeZone)}  ${actorText(actor)} ${TYPE_TEXT[type]}${fields.length > 0 ? `: ${fields.join("; ")}` : ""}`
    })
    .join("\n")
