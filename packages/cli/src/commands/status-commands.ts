import { DATE_INPUT_HELP, parseDateInput } from "@taxa/shared/dates/date-input"
import type { ChangeStatusRequest } from "@taxa/shared/tasks/task-requests"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ExitCode } from "../cli-io.ts"
import {
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
  print(context, task, () => `${verb} ${task.ref}  ${task.title}`)
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
  statusCommand({ name: "done", summary: "Mark a task done", status: TaskStatus.DONE, verb: "Done:" }),
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
  deletion("restore", "Bring back a deleted task", "Restored", false)
]
