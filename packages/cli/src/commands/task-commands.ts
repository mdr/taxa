import { When } from "@taxa/shared/tasks/when"
import { z } from "zod"
import { CreateTaskRequestSchema, UpdateTaskRequestSchema } from "@taxa/shared/tasks/task-requests"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ExitCode } from "../cli-io.ts"
import { linked, oneArgument, print, stringOption, UsageError, type Command, type CommandContext } from "../command.ts"
import { activityLines } from "../format/activity-format.ts"
import { taskDetail, taskLines } from "../format/task-format.ts"
import { latestComments } from "../format/comment-format.ts"
import { recentOccurrences } from "../format/occurrence-format.ts"
import { readStdinJson, STDIN } from "../input/stdin-json.ts"
import { clearedFrom, fieldsFrom, repeatedOption, TASK_FIELD_HELP, TASK_FIELD_OPTIONS } from "../input/task-input.ts"
import { ifVersion, VERSION_HELP, VERSION_OPTION } from "../input/version-option.ts"

const ALL_WHENS = Object.values(When).join(",")

const NewTasksSchema = z.union([CreateTaskRequestSchema, z.array(CreateTaskRequestSchema).min(1)])

const showTask = async (context: CommandContext, task: Task): Promise<void> => {
  const [domains, followsOn, ledTo, comments, occurrences] = await Promise.all([
    context.client.domains(),
    task.followsOnId === undefined ? undefined : context.client.task(task.followsOnId).catch(() => undefined),
    context.client.tasks({
      followsOn: task.id,
      status: Object.values(TaskStatus).join(","),
      when: ALL_WHENS,
      includeNotStarted: "true"
    }),
    context.client.comments(task.id),
    task.repeat ? context.client.occurrences(task.id) : []
  ])
  const shown = linked(context, task)
  print(
    context,
    shown,
    () =>
      taskDetail(
        task,
        domains.find(({ id }) => id === task.domainId),
        context.today(),
        shown.url,
        {
          followsOn,
          ledTo
        }
      ) +
      recentOccurrences(occurrences, context.today()) +
      latestComments(comments, task.ref, context.io.timeZone)
  )
}

/** Says what was added, and where to find it. */
const printAdded = (context: CommandContext, tasks: Task[]): void => {
  const shown = tasks.map((task) => linked(context, task))
  print(context, shown.length === 1 ? shown[0] : shown, () =>
    shown.map(({ ref, title, url }) => `Added ${ref}  ${title}\n${url}`).join("\n")
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
        printAdded(context, tasks)
        return ExitCode.OK
      }
      printAdded(context, [await context.client.createTask(requests, key)])
      return ExitCode.OK
    }
    const title = positionals.join(" ").trim()
    if (title === "") throw new UsageError("Give the task a title.")
    const task = await context.client.createTask(
      { title, ...fieldsFrom(values, context.today()), tags: repeatedOption(values, "tag") },
      key
    )
    printAdded(context, [task])
    return ExitCode.OK
  }
}

const list: Command = {
  name: "list",
  summary: "List active tasks, most urgent first",
  usage: `[options]
  --domain PREFIX       Only this domain's
  --inbox               Only your Inbox
  --tag NAME            Only those with this tag, in any case
  --search WORDS        Only those with every word in their title, notes, tags or comments, best matches first
  --follows-on TASK     Only those that follow on from this task
  --status LIST         Only these statuses, e.g. done or open,waiting (default: open, in progress, waiting)
  --when LIST           Only these, e.g. today or soon,someday (today, on a day, soon, any time, someday;
                        default: all but someday)
  --all                 Include tasks whose start date is still to come, and someday ones
  --deleted             The bin instead: deleted tasks, the last deleted first (taxa restore brings one back;
                        after 30 days there, one is deleted forever)`,
  options: {
    domain: { type: "string" },
    inbox: { type: "boolean" },
    tag: { type: "string" },
    search: { type: "string" },
    "follows-on": { type: "string" },
    status: { type: "string" },
    when: { type: "string" },
    all: { type: "boolean" },
    deleted: { type: "boolean" }
  },
  run: async (context, values, positionals) => {
    if (positionals.length > 0) throw new UsageError(`list takes no arguments, got: ${positionals.join(" ")}`)
    const tasks = await context.client.tasks({
      domain: stringOption(values, "domain"),
      status: stringOption(values, "status")?.toUpperCase().replaceAll(" ", "_"),
      inbox: values["inbox"] === true ? "true" : undefined,
      tag: stringOption(values, "tag"),
      search: stringOption(values, "search"),
      followsOn: stringOption(values, "follows-on"),
      includeNotStarted: values["all"] === true ? "true" : undefined,
      when: values["all"] === true ? ALL_WHENS : stringOption(values, "when")?.toUpperCase().replaceAll(" ", "_"),
      deleted: values["deleted"] === true ? "true" : undefined
    })
    print(
      context,
      tasks.map((task) => linked(context, task)),
      () => taskLines(tasks, context.today())
    )
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
  --untag NAME          Take a tag off; again for more
  --append-notes TEXT   Add to the end of the notes, keeping what's there (for progress, taxa comment)
  --clear FIELDS        Empty these fields, e.g. due,estimate (due, scheduled, at, start, estimate, energy, horizon, follows-on, repeat)
${VERSION_HELP}
With -, stdin holds {"set": {...}, "clear": [...], "addTags": [...], "removeTags": [...], "appendNotes": "..."},
as the API's UpdateTaskRequest.`,
  options: {
    ...TASK_FIELD_OPTIONS,
    title: { type: "string" },
    untag: { type: "string", multiple: true },
    "append-notes": { type: "string" },
    clear: { type: "string" },
    ...VERSION_OPTION
  },
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
            clear: clearedFrom(values),
            addTags: repeatedOption(values, "tag"),
            removeTags: repeatedOption(values, "untag"),
            appendNotes: stringOption(values, "append-notes")
          }
    const nothing = (list: readonly unknown[] | undefined): boolean => (list ?? []).length === 0
    if (
      Object.keys(request.set).length === 0 &&
      nothing(request.clear) &&
      nothing(request.addTags) &&
      nothing(request.removeTags) &&
      request.appendNotes === undefined
    ) {
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
