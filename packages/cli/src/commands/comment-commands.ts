import { taskUrl } from "../format/task-url.ts"
import { ExitCode } from "../cli-io.ts"
import { CommentIdSchema } from "@taxa/shared/ids"
import { idFrom, oneArgument, print, stringOption, UsageError, type Command, type CommandContext } from "../command.ts"
import { ifVersion } from "../input/version-option.ts"
import { commentLines } from "../format/comment-format.ts"
import { STDIN } from "../input/stdin-json.ts"

/** The text after the task or comment, or Markdown on stdin with -. */
const textFrom = async (context: CommandContext, words: string[]): Promise<string> => {
  const text = words.length === 1 && words[0] === STDIN ? await context.io.readStdin() : words.join(" ")
  if (text.trim() === "") throw new UsageError("Say what the comment should say.")
  return text
}

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
    const added = await context.client.addComment(
      ref,
      { body: await textFrom(context, words) },
      stringOption(values, "idempotency-key")
    )
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

const editComment: Command = {
  name: "edit-comment",
  summary: "Change what a comment of yours says",
  usage: `<id> <text>   or   taxa edit-comment <id> - < comment.md
  --if-version N         Only if the comment is still at version N (exit 3 if not)
taxa comments shows each comment's id. Only whoever wrote a comment can change it.`,
  options: { "if-version": { type: "string" } },
  run: async (context, values, positionals) => {
    const [id, ...words] = positionals
    if (id === undefined) throw new UsageError("Say which comment, by its id from taxa comments.")
    const edited = await context.client.editComment(
      idFrom(CommentIdSchema, id, "a comment"),
      { body: await textFrom(context, words) },
      ifVersion(values)
    )
    print(context, edited, () => "Edited the comment.")
    return ExitCode.OK
  }
}

const deleteComment: Command = {
  name: "delete-comment",
  summary: "Delete a comment of yours (taxa restore-comment brings it back)",
  usage: "<id>",
  options: {},
  run: async (context, _values, positionals) => {
    const id = idFrom(CommentIdSchema, oneArgument(positionals, "comment"), "a comment")
    print(
      context,
      await context.client.deleteComment(id),
      () => `Deleted the comment. taxa restore-comment ${id} brings it back.`
    )
    return ExitCode.OK
  }
}

const restoreComment: Command = {
  name: "restore-comment",
  summary: "Bring back a comment of yours that was deleted",
  usage: "<id>",
  options: {},
  run: async (context, _values, positionals) => {
    const id = idFrom(CommentIdSchema, oneArgument(positionals, "comment"), "a comment")
    print(context, await context.client.restoreComment(id), () => "Restored the comment.")
    return ExitCode.OK
  }
}

export const COMMENT_COMMANDS: Command[] = [comment, comments, editComment, deleteComment, restoreComment]
