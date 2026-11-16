import { actorText } from "../identity/actor-text.ts"
import { Energy, Priority, TaskStatus } from "../tasks/task.ts"
import { ENERGY_TEXT, PRIORITY_TEXT, STATUS_TEXT } from "../tasks/task-text.ts"
import { ActivityType, type Activity, type FieldChange } from "./activity.ts"

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
  return typeof value === "number" || typeof value === "boolean" ? String(value) : "someone"
}

const changeText = (field: string, { from, to }: FieldChange): string =>
  `${field} ${valueText(from)} → ${valueText(to)}`

/** Who did what: `Matt changed: priority normal → high`. */
export const activityText = ({ actor, type, changes }: Activity): string => {
  const fields =
    type === ActivityType.TASK_CREATED
      ? []
      : Object.entries(changes).map(([field, change]) => changeText(field, change))
  return `${actorText(actor)} ${TYPE_TEXT[type]}${fields.length > 0 ? `: ${fields.join("; ")}` : ""}`
}
