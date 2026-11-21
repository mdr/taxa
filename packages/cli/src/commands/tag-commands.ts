import { ExitCode } from "../cli-io.ts"
import { print, UsageError, type Command } from "../command.ts"

const tags: Command = {
  name: "tags",
  summary: "List the tags on tasks you can see",
  usage: "",
  options: {},
  run: async (context, _values, positionals) => {
    if (positionals.length > 0) throw new UsageError(`tags takes no arguments, got: ${positionals.join(" ")}`)
    const all = await context.client.tags()
    print(context, all, () =>
      all.length === 0
        ? 'No tags yet: add one with taxa edit <ref> --tag "Life Admin".'
        : all.map(({ name, openCount }) => `${name}  (${openCount} to do)`).join("\n")
    )
    return ExitCode.OK
  }
}

const renameTag: Command = {
  name: "rename-tag",
  summary: "Rename a tag on every task you can see",
  usage: '<from> <to>   e.g. taxa rename-tag "life admin" "Life Admin"',
  options: {},
  run: async (context, _values, positionals) => {
    const [from, to, ...rest] = positionals
    if (from === undefined || to === undefined || rest.length > 0)
      throw new UsageError("Give the tag's name and its new name, quoting any with spaces.")
    const { renamed } = await context.client.renameTag({ from, to })
    print(context, { renamed }, () => `Renamed it on ${renamed} ${renamed === 1 ? "task" : "tasks"}.`)
    return ExitCode.OK
  }
}

export const TAG_COMMANDS: Command[] = [tags, renameTag]
