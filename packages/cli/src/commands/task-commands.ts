import { z } from "zod"
import { CreateTaskRequestSchema, UpdateTaskRequestSchema } from "@taxa/shared/tasks/task-requests"
import type { Task } from "@taxa/shared/tasks/task"
import { ExitCode } from "../cli-io.ts"
import { oneArgument, print, stringOption, UsageError, type Command, type CommandContext } from "../command.ts"
import { activityLines } from "../format/activity-format.ts"
import { taskDetail, taskLines } from "../format/task-format.ts"
import { readStdinJson, STDIN } from "../input/stdin-json.ts"
import { clearedFrom, fieldsFrom, TASK_FIELD_HELP, TASK_FIELD_OPTIONS } from "../input/task-input.ts"
import { ifVersion, VERSION_HELP, VERSION_OPTION } from "../input/version-option.ts"

const NewTasksSchema = z.union([CreateTaskRequestSchema, z.array(CreateTaskRequestSchema).min(1)])

const showTask = async (context: CommandContext, task: Task): Promise<void> => {
  const domains = await context.client.domains()
  print(context, task, () =>
    taskDetail(
      task,
      domains.find(({ id }) => id === task.domainId),
      context.today()
    )
  )
}

const add: Command = {
  name: "add",
  summary: "Add a task",
  usage: `<title> [options]   or   taxa add - < task.json
${TASK_FIELD_HELP}
  --idempotency-key KEY  Retrying with the same key never adds it twice
With -, stdin holds one task or an array of them, as the API's CreateTaskRequest.`,
  options: { ...TASK_FIELD_OPTIONS, "idempotency-key": { type: "string" } },
  run: async (context, values, positionals) => {
    const key = stringOption(values, "idempotency-key")
    if (positionals.length === 1 && positionals[0] === STDIN) {
      const requests = await readStdinJson(context.io, NewTasksSchema, "a task or an array of tasks")
      if (Array.isArray(requests)) {
        const tasks: Task[] = []
        for (const [index, request] of requests.entries()) {
          tasks.push(await context.client.createTask(request, key && `${key}#${index}`))
        }
        print(context, tasks, () => taskLines(tasks, context.today()))
        return ExitCode.OK
      }
      const task = await context.client.createTask(requests, key)
      print(context, task, () => `Added ${task.ref}  ${task.title}`)
      return ExitCode.OK
    }
    const title = positionals.join(" ").trim()
    if (title === "") throw new UsageError("Give the task a title.")
    const task = await context.client.createTask({ title, ...fieldsFrom(values, context.today()) }, key)
    print(context, task, () => `Added ${task.ref}  ${task.title}`)
    return ExitCode.OK
  }
}

const list: Command = {
  name: "list",
  summary: "List active tasks, most urgent first",
  usage: `[options]
  --domain PREFIX       Only this domain's
  --inbox               Only your Inbox
  --status LIST         Only these statuses, e.g. done or open,waiting (default: open, in progress, waiting)
  --all                 Include tasks whose start date is still to come`,
  options: {
    domain: { type: "string" },
    inbox: { type: "boolean" },
    status: { type: "string" },
    all: { type: "boolean" }
  },
  run: async (context, values, positionals) => {
    if (positionals.length > 0) throw new UsageError(`list takes no arguments, got: ${positionals.join(" ")}`)
    const tasks = await context.client.tasks({
      domain: stringOption(values, "domain"),
      status: stringOption(values, "status")?.toUpperCase().replaceAll(" ", "_"),
      inbox: values["inbox"] === true ? "true" : undefined,
      includeNotStarted: values["all"] === true ? "true" : undefined
    })
    print(context, tasks, () => taskLines(tasks, context.today()))
    return ExitCode.OK
  }
}

const show: Command = {
  name: "show",
  summary: "Show everything about a task",
  usage: "<ref>",
  options: {},
  run: async (context, _values, positionals) => {
    await showTask(context, await context.client.task(oneArgument(positionals, "task")))
    return ExitCode.OK
  }
}

const edit: Command = {
  name: "edit",
  summary: "Change a task's fields",
  usage: `<ref> [options]   or   taxa edit <ref> - < changes.json
  --title TEXT          A new title
${TASK_FIELD_HELP}
  --clear FIELDS        Empty these fields, e.g. due,estimate (due, scheduled, at, start, estimate, energy)
${VERSION_HELP}
With -, stdin holds {"set": {...}, "clear": [...]}, as the API's UpdateTaskRequest.`,
  options: { ...TASK_FIELD_OPTIONS, title: { type: "string" }, clear: { type: "string" }, ...VERSION_OPTION },
  run: async (context, values, positionals) => {
    const [ref, source, ...rest] = positionals
    if (ref === undefined) throw new UsageError("Say which task.")
    if (rest.length > 0 || (source !== undefined && source !== STDIN)) {
      throw new UsageError(`Expected a task, and optionally -, got: ${positionals.join(" ")}`)
    }
    const request =
      source === STDIN
        ? await readStdinJson(context.io, UpdateTaskRequestSchema, "an update")
        : {
            set: {
              ...fieldsFrom(values, context.today()),
              ...(stringOption(values, "title") !== undefined && { title: stringOption(values, "title") })
            },
            clear: clearedFrom(values)
          }
    if (Object.keys(request.set).length === 0 && request.clear.length === 0) {
      throw new UsageError("Say what to change, e.g. --due friday or --clear due.")
    }
    await showTask(context, await context.client.updateTask(ref, request, ifVersion(values)))
    return ExitCode.OK
  }
}

const log: Command = {
  name: "log",
  summary: "Every change to a task, with who made it",
  usage: "<ref>",
  options: {},
  run: async (context, _values, positionals) => {
    const [activity, domains] = await Promise.all([
      context.client.activity(oneArgument(positionals, "task")),
      context.client.domains()
    ])
    const domainName = (id: string): string | undefined => domains.find((domain) => domain.id === id)?.name
    print(context, activity, () => activityLines(activity, context.io.timeZone, { today: context.today(), domainName }))
    return ExitCode.OK
  }
}

export const TASK_COMMANDS: Command[] = [add, list, show, edit, log]
