import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import { ExitCode } from "../cli-io.ts"
import { UsageError, type CommandContext, type OptionValues } from "../command.ts"
import { reportApiError } from "../report-error.ts"

/** For a command's usage: it takes one task or several. */
export const REFS = "<ref>..."

export const MANY_HELP = "Several refs change each task in turn, carrying on past any that fail."

/**
 * Does `act` to each task named, in turn. One task is done as ever, its
 * errors left to the command's handling. Several are each done and reported
 * on their own, so one that fails doesn't stop the rest; with --json, their
 * results come as one array. The exit code is the first failure's.
 */
export const eachTask = async (
  context: CommandContext,
  refs: readonly string[],
  values: OptionValues,
  act: (context: CommandContext, ref: string, many: boolean) => Promise<ExitCode>
): Promise<ExitCode> => {
  const [only, ...more] = refs
  if (only === undefined) throw new UsageError("Say which task.")
  if (more.length === 0) return act(context, only, false)
  if (values["if-version"] !== undefined)
    throw new UsageError("--if-version is for one task, as each has its own version.")
  const results: unknown[] = []
  let exitCode = ExitCode.OK
  for (const ref of refs) {
    let printed = ""
    const each = context.json
      ? { ...context, io: { ...context.io, stdout: (text: string) => void (printed += text) } }
      : context
    const result = await act(each, ref, true).catch((error: unknown) => {
      if (error instanceof TaxaApiError) return reportApiError(error, context.json, each.io, context.style)
      // Something about this task alone, such as skipping one that doesn't repeat.
      if (!(error instanceof UsageError)) throw error
      context.io.stderr(`${error.message}\n`)
      return ExitCode.USAGE
    })
    if (context.json && printed !== "") results.push(JSON.parse(printed))
    if (exitCode === ExitCode.OK) exitCode = result
  }
  if (context.json) context.io.stdout(`${JSON.stringify(results, undefined, 2)}\n`)
  return exitCode
}
