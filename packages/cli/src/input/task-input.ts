import { DATE_INPUT_HELP, parseDateInput } from "@taxa/shared/dates/date-input"
import { isIsoTime, type IsoDate } from "@taxa/shared/dates/plain-date"
import { parseEstimate } from "@taxa/shared/tasks/estimate"
import { ClearableField, type UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import { Horizon, Priority } from "@taxa/shared/tasks/task"
import { MissedDays, type RepeatRequest } from "@taxa/shared/tasks/repeat"
import { REPEAT_EXAMPLES, repeatFromPhrase } from "@taxa/shared/tasks/repeat-phrases"
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
  horizon: { type: "string" },
  "follows-on": { type: "string" },
  tag: { type: "string", multiple: true },
  inbox: { type: "boolean" },
  filed: { type: "boolean" },
  repeat: { type: "string" },
  missed: { type: "string" }
} as const

/** Every value given for an option that can be given more than once. */
export const repeatedOption = (values: OptionValues, name: string): string[] => {
  const value = values[name]
  return Array.isArray(value) ? value.filter((each): each is string => typeof each === "string") : []
}

export const TASK_FIELD_HELP = `  --domain PREFIX       The domain it's in; to add one, needed only when you have more than one
  --notes TEXT          Notes, in Markdown
  --due DATE            When it must be done by
  --scheduled DATE      When you plan to do it
  --at HH:MM            A time on the scheduled day
  --start DATE          Hide it until then
  --priority LEVEL      urgent, high, normal or low
  --estimate TIME       How long it'll take: 30m, 1h, 1h30m
  --horizon WHEN        soon or someday, for a task without a date
  --follows-on TASK     The task it follows on from, by ref or id
  --tag NAME            Tag it; again for more, e.g. --tag "Life Admin" --tag errand
  --inbox               In your Inbox, to sort out later: as a task added without saying when is
  --filed               Filed: sorted out, out of your Inbox (taxa file does just this)
  --repeat HOW          Make it repeat: daily, every weekday, every monday and thursday,
                        monthly on the 1st, 3 days after done (none: stop it repeating)
  --missed WHAT         For a repeating task, days that go by undone: skip (each recorded
                        as missed, and it moves on) or carry-over (it waits till it's done).
                        By default, skipped if it's daily, otherwise carried over
DATE is ${DATE_INPUT_HELP}.`

/** --inbox or --filed, if either: whether it's in the Inbox. */
const inboxOption = (values: OptionValues): boolean | undefined => {
  if (values["inbox"] === true && values["filed"] === true) throw new UsageError("--inbox or --filed, not both.")
  if (values["inbox"] === true) return true
  return values["filed"] === true ? false : undefined
}

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

const STOP_REPEATING = "none"

const MISSED_CHOICES: Record<string, MissedDays> = { skip: MissedDays.SKIP, "carry-over": MissedDays.CARRY_OVER }

/** What --missed says becomes of days missed. */
export const missedOption = (values: OptionValues): MissedDays | undefined =>
  optional(stringOption(values, "missed"), (text) => {
    const missed = MISSED_CHOICES[text.trim().toLowerCase()]
    if (!missed) throw new UsageError(`--missed must be skip or carry-over, not ${JSON.stringify(text)}.`)
    return missed
  })

/** How --repeat says it repeats, with --missed; undefined for none, which stops it. */
const repeatOption = (values: OptionValues): RepeatRequest | undefined => {
  const text = stringOption(values, "repeat")
  if (text === undefined || text.trim().toLowerCase() === STOP_REPEATING) return undefined
  const missed = missedOption(values)
  const repeat = repeatFromPhrase(text)
  if (!repeat)
    throw new UsageError(
      `--repeat must say how often, such as ${REPEAT_EXAMPLES.map((example) => JSON.stringify(example)).join(", ")}; not ${JSON.stringify(text)}.`
    )
  return missed ? { ...repeat, missed } : repeat
}

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
    horizon: optional(stringOption(values, "horizon"), (text) => choice(Horizon, text, "--horizon")),
    followsOn: stringOption(values, "follows-on"),
    estimateMinutes: optional(stringOption(values, "estimate"), (text) => {
      const minutes = parseEstimate(text)
      if (minutes === undefined)
        throw new UsageError(`--estimate must be like 30m, 1h or 1h30m, not ${JSON.stringify(text)}.`)
      return minutes
    }),
    inbox: inboxOption(values),
    repeat: repeatOption(values)
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
  const stops = stringOption(values, "repeat")?.trim().toLowerCase() === STOP_REPEATING ? [ClearableField.REPEAT] : []
  if (text === undefined) return stops
  return [
    ...text
      .split(",")
      .map((name) => CLEAR_ALIASES[name.trim().toLowerCase()] ?? choice(ClearableField, name, "--clear")),
    ...stops
  ]
}
