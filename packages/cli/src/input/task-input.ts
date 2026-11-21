import { DATE_INPUT_HELP, parseDateInput } from "@taxa/shared/dates/date-input"
import { isIsoTime, type IsoDate } from "@taxa/shared/dates/plain-date"
import { parseEstimate } from "@taxa/shared/tasks/estimate"
import { ClearableField, type UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import { Energy, Horizon, Priority } from "@taxa/shared/tasks/task"
import { stringOption, UsageError, type OptionValues } from "../command.ts"

/** The options that set a task's fields, shared by `add` and `edit`. */
export const TASK_FIELD_OPTIONS = {
  domain: { type: "string" },
  notes: { type: "string" },
  due: { type: "string" },
  scheduled: { type: "string" },
  at: { type: "string" },
  start: { type: "string" },
  priority: { type: "string" },
  estimate: { type: "string" },
  energy: { type: "string" },
  horizon: { type: "string" },
  "follows-on": { type: "string" },
  tag: { type: "string", multiple: true },
  inbox: { type: "boolean" }
} as const

/** Every value given for an option that can be given more than once. */
export const repeatedOption = (values: OptionValues, name: string): string[] => {
  const value = values[name]
  return Array.isArray(value) ? value.filter((each): each is string => typeof each === "string") : []
}

export const TASK_FIELD_HELP = `  --domain PREFIX       File it in this domain, out of the Inbox
  --notes TEXT          Notes, in Markdown
  --due DATE            When it must be done by
  --scheduled DATE      When you plan to do it
  --at HH:MM            A time on the scheduled day
  --start DATE          Hide it until then
  --priority LEVEL      urgent, high, normal or low
  --estimate TIME       How long it'll take: 30m, 1h, 1h30m
  --energy LEVEL        low, medium or high
  --horizon WHEN        soon or someday, for a task without a date
  --follows-on TASK     The task it follows on from, by ref or id
  --tag NAME            Tag it; again for more, e.g. --tag "Life Admin" --tag errand
  --inbox               Put it back in the Inbox, out of its domain
DATE is ${DATE_INPUT_HELP}.`

const choice = <T extends string>(choices: Record<string, T>, text: string, what: string): T => {
  const found = Object.values(choices).find((value) => value.toLowerCase() === text.trim().toLowerCase())
  if (!found)
    throw new UsageError(
      `${what} must be ${Object.values(choices).join(", ").toLowerCase()}, not ${JSON.stringify(text)}.`
    )
  return found
}

const dateOption = (values: OptionValues, name: string, today: IsoDate): IsoDate | undefined => {
  const text = stringOption(values, name)
  if (text === undefined) return undefined
  const date = parseDateInput(text, today)
  if (!date) throw new UsageError(`--${name} must be ${DATE_INPUT_HELP}, not ${JSON.stringify(text)}.`)
  return date
}

const optional = <T>(text: string | undefined, read: (text: string) => T): T | undefined =>
  text === undefined ? undefined : read(text)

/** The fields the options set, as an update's `set`. */
export const fieldsFrom = (values: OptionValues, today: IsoDate): NonNullable<UpdateTaskRequest["set"]> => {
  const at = stringOption(values, "at")
  if (at !== undefined && !isIsoTime(at))
    throw new UsageError(`--at must be a time written HH:MM, not ${JSON.stringify(at)}.`)
  const fields = {
    domain: stringOption(values, "domain"),
    notes: stringOption(values, "notes"),
    due: dateOption(values, "due", today),
    scheduled: dateOption(values, "scheduled", today),
    scheduledTime: at,
    start: dateOption(values, "start", today),
    priority: optional(stringOption(values, "priority"), (text) => choice(Priority, text, "--priority")),
    energy: optional(stringOption(values, "energy"), (text) => choice(Energy, text, "--energy")),
    horizon: optional(stringOption(values, "horizon"), (text) => choice(Horizon, text, "--horizon")),
    followsOn: stringOption(values, "follows-on"),
    estimateMinutes: optional(stringOption(values, "estimate"), (text) => {
      const minutes = parseEstimate(text)
      if (minutes === undefined)
        throw new UsageError(`--estimate must be like 30m, 1h or 1h30m, not ${JSON.stringify(text)}.`)
      return minutes
    }),
    inbox: values["inbox"] === true ? true : undefined
  }
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
}

/** --clear takes the options' names as well as the API's. */
const CLEAR_ALIASES: Record<string, ClearableField> = {
  at: ClearableField.SCHEDULED_TIME,
  estimate: ClearableField.ESTIMATE_MINUTES,
  "follows-on": ClearableField.FOLLOWS_ON
}

/** The fields --clear names. */
export const clearedFrom = (values: OptionValues): ClearableField[] => {
  const text = stringOption(values, "clear")
  if (text === undefined) return []
  return text
    .split(",")
    .map((name) => CLEAR_ALIASES[name.trim().toLowerCase()] ?? choice(ClearableField, name, "--clear"))
}
