import { DATE_INPUT_HELP, parseDateInput } from "@taxa/shared/dates/date-input"
import { ClearableField, type ChangeStatusRequest } from "@taxa/shared/tasks/task-requests"
import { formatDay } from "@taxa/shared/dates/date-format"
import { OccurrenceOutcome } from "@taxa/shared/tasks/repeat"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ExitCode } from "../cli-io.ts"
import {
  linked,
  oneArgument,
  print,
  stringOption,
  UsageError,
  type Command,
  type CommandContext,
  type OptionValues
} from "../command.ts"
import { STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { ifVersion, VERSION_HELP, VERSION_OPTION } from "../input/version-option.ts"

const changed = (context: CommandContext, task: Task, verb: string): ExitCode => {
  print(context, linked(context, task), () => `${verb} ${task.ref}  ${task.title}`)
  return ExitCode.OK
}

interface StatusCommandSpec {
  name: string
  summary: string
  status: TaskStatus
  verb: string
  usage?: string
  options?: Command["options"]
  request?: (values: OptionValues, context: CommandContext) => Omit<ChangeStatusRequest, "status">
}

const statusCommand = ({
  name,
  summary,
  status,
  verb,
  usage = "",
  options = {},
  request
}: StatusCommandSpec): Command => ({
  name,
  summary,
  usage: `<ref>${usage ? ` ${usage}` : ""}\n${VERSION_HELP}`,
  options: { ...options, ...VERSION_OPTION },
  run: async (context, values, positionals) => {
    const ref = oneArgument(positionals, "task")
    const task = await context.client.changeStatus(ref, { status, ...request?.(values, context) }, ifVersion(values))
    return changed(context, task, verb)
  }
})

const followUpFrom = (values: OptionValues, context: CommandContext): string | undefined => {
  const text = stringOption(values, "follow-up")
  if (text === undefined) return undefined
  const date = parseDateInput(text, context.today())
  if (!date) throw new UsageError(`--follow-up must be ${DATE_INPUT_HELP}, not ${JSON.stringify(text)}.`)
  return date
}

const deletion = (name: string, summary: string, verb: string, versioned: boolean): Command => ({
  name,
  summary,
  usage: versioned ? `<ref>\n${VERSION_HELP}` : "<ref>",
  options: versioned ? VERSION_OPTION : {},
  run: async (context, values, positionals) => {
    const ref = oneArgument(positionals, "task")
    const task = versioned
      ? await context.client.deleteTask(ref, ifVersion(values))
      : await context.client.restoreTask(ref)
    return changed(context, task, verb)
  }
})

/** Does or skips a repeating task's occurrence, for the date it's at, so a retry can't do it twice. */
const recorded = async (
  context: CommandContext,
  task: Task,
  outcome: OccurrenceOutcome.DONE | OccurrenceOutcome.SKIPPED
): Promise<ExitCode> => {
  const moved = await context.client.recordOccurrence(task.ref, { outcome, date: task.scheduled })
  const today = context.today()
  const verb = outcome === OccurrenceOutcome.DONE ? "Done" : "Skipped"
  const next = moved.scheduled === undefined ? "" : `; next ${formatDay(moved.scheduled, today)}`
  const when = task.scheduled === undefined ? "" : ` for ${formatDay(task.scheduled, today)}`
  print(context, linked(context, moved), () => `${verb} ${moved.ref}${when}${next}  ${moved.title}`)
  return ExitCode.OK
}

const done: Command = {
  name: "done",
  summary: "Mark a task done; a repeating one, done this time",
  usage: `<ref> [--stop-repeating]
  --stop-repeating      A repeating task: stop it repeating, and mark it done for good
${VERSION_HELP}`,
  options: { "stop-repeating": { type: "boolean" }, ...VERSION_OPTION },
  run: async (context, values, positionals) => {
    const ref = oneArgument(positionals, "task")
    const task = await context.client.task(ref)
    if (task.repeat && values["stop-repeating"] !== true) return recorded(context, task, OccurrenceOutcome.DONE)
    const stopped = task.repeat
      ? await context.client.updateTask(ref, { clear: [ClearableField.REPEAT] }, ifVersion(values))
      : task
    const finished = await context.client.changeStatus(
      ref,
      { status: TaskStatus.DONE },
      task.repeat ? stopped.version : ifVersion(values)
    )
    return changed(context, finished, "Done:")
  }
}

const skip: Command = {
  name: "skip",
  summary: "Skip a repeating task this time, moving it on to its next date",
  usage: "<ref>",
  options: {},
  run: async (context, _values, positionals) => {
    const task = await context.client.task(oneArgument(positionals, "task"))
    if (!task.repeat) throw new UsageError(`${task.ref} doesn't repeat: taxa cancel, to cancel it.`)
    return recorded(context, task, OccurrenceOutcome.SKIPPED)
  }
}

const undo: Command = {
  name: "undo",
  summary: "Undo a change to a task, by its number in taxa log",
  usage: `<ref> --version N
  --version N           The change to undo, by the number taxa log gives it
It takes a number, not "the last", because the last change may be someone else's.
Undoing a change that added the task deletes it; one that deleted it restores it.
Undoing an undo redoes it. Exit 3 if what the change did has been changed since.`,
  options: { version: { type: "string" } },
  run: async (context, values, positionals) => {
    const ref = oneArgument(positionals, "task")
    const typed = stringOption(values, "version")
    if (typed === undefined) throw new UsageError("Say which change to undo with --version N, its number in taxa log.")
    const version = Number(typed)
    if (!Number.isInteger(version) || version < 1)
      throw new UsageError(`--version must be a change's number, not ${typed}.`)
    const task = await context.client.undoTask(ref, version)
    print(context, linked(context, task), () => `Undid change ${version} to ${task.ref}  ${task.title}`)
    return ExitCode.OK
  }
}

export const STATUS_COMMANDS: Command[] = [
  statusCommand({
    name: "start",
    summary: "Mark a task in progress, by you (or your agent)",
    status: TaskStatus.IN_PROGRESS,
    verb: "Started"
  }),
  statusCommand({
    name: "wait",
    summary: "Mark a task waiting on someone or something",
    status: TaskStatus.WAITING,
    verb: "Waiting:",
    usage: `[--on TEXT] [--follow-up DATE]
  --on TEXT             What it's waiting on
  --follow-up DATE      When to look at it again (default: in a week)`,
    options: { on: { type: "string" }, "follow-up": { type: "string" } },
    request: (values, context) => ({ waitingOn: stringOption(values, "on"), followUp: followUpFrom(values, context) })
  }),
  done,
  skip,
  statusCommand({
    name: "cancel",
    summary: "Cancel a task, optionally saying why",
    status: TaskStatus.CANCELLED,
    verb: "Cancelled",
    usage: "[--reason TEXT]",
    options: { reason: { type: "string" } },
    request: (values) => ({ reason: stringOption(values, "reason") })
  }),
  statusCommand({
    name: "reopen",
    summary: `Make a task ${STATUS_TEXT[TaskStatus.OPEN]} again`,
    status: TaskStatus.OPEN,
    verb: "Reopened"
  }),
  deletion("delete", "Delete a task (restore brings it back)", "Deleted", true),
  deletion("restore", "Bring back a deleted task", "Restored", false),
  undo
]
