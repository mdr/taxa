import { taskUrl } from "../format/task-url.ts"
import { ExitCode } from "../cli-io.ts"
import { oneArgument, print, stringOption, UsageError, type Command } from "../command.ts"
import { commentLines } from "../format/comment-format.ts"
import { STDIN } from "../input/stdin-json.ts"

const comment: Command = {
  name: "comment",
  summary: "Comment on a task: what you did, what you found, what's left",
  usage: `<ref> <text>   or   taxa comment <ref> - < comment.md
  --idempotency-key KEY  Retrying with the same key never adds it twice
The text is Markdown. It's added to the task's comments, and the task itself stays as it is.`,
  options: { "idempotency-key": { type: "string" } },
  run: async (context, values, positionals) => {
    const [ref, ...words] = positionals
    if (ref === undefined) throw new UsageError("Say which task.")
    const body = words.length === 1 && words[0] === STDIN ? await context.io.readStdin() : words.join(" ")
    if (body.trim() === "") throw new UsageError("Say what to comment.")
    const added = await context.client.addComment(ref, { body }, stringOption(values, "idempotency-key"))
    const task = await context.client.task(added.taskId)
    print(context, added, () => `Commented on ${task.ref}  ${task.title}\n${taskUrl(context.web, task.ref)}`)
    return ExitCode.OK
  }
}

const comments: Command = {
  name: "comments",
  summary: "A task's comments, oldest first",
  usage: "<ref>",
  options: {},
  run: async (context, _values, positionals) => {
    const found = await context.client.comments(oneArgument(positionals, "task"))
    print(context, found, () => commentLines(found, context.io.timeZone))
    return ExitCode.OK
  }
}

export const COMMENT_COMMANDS: Command[] = [comment, comments]
