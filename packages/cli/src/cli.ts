import { parseArgs, type ParseArgsOptionsConfig } from "node:util"
import { ProblemType } from "@taxa/shared/api/problem"
import { TaxaApiError, TaxaClient } from "@taxa/shared/api/taxa-client"
import { dateIn } from "@taxa/shared/dates/plain-date"
import { DEFAULT_SERVER, ExitCode, type CliIo } from "./cli-io.ts"
import { ACCOUNT_COMMANDS } from "./commands/account-commands.ts"
import { STATUS_COMMANDS } from "./commands/status-commands.ts"
import { TASK_COMMANDS } from "./commands/task-commands.ts"
import { UsageError, type Command } from "./command.ts"
import { healthCommand } from "./health-command.ts"

const COMMANDS: Command[] = [...TASK_COMMANDS, ...STATUS_COMMANDS, ...ACCOUNT_COMMANDS]

const GLOBAL_OPTIONS = {
  json: { type: "boolean", default: false },
  server: { type: "string" },
  help: { type: "boolean", short: "h", default: false }
} satisfies ParseArgsOptionsConfig

const width = Math.max(...COMMANDS.map(({ name }) => name.length), "health".length)

const USAGE = `Usage: taxa <command> [arguments] [--json] [--server URL]

Commands:
${COMMANDS.map(({ name, summary }) => `  ${name.padEnd(width)}  ${summary}`).join("\n")}
  ${"health".padEnd(width)}  Whether the server and its database are up

A task is named by its reference (H-142), its number (142) or its id.
taxa <command> --help says more about a command.

--json prints the API's JSON. Exit codes: 0 OK, 1 failed, 2 bad usage,
3 the task changed since --if-version, 4 not found.

Environment:
  TAXA_SERVER         The server (default ${DEFAULT_SERVER}); --server overrides it
  TAXA_API_KEY        Your API key, or your agent's
  TAXA_AGENT_CONTEXT  For agents: what you're working on, recorded with your changes
`

const commandUsage = ({ name, summary, usage }: Command): string => `${summary}.\n\nUsage: taxa ${name} ${usage}\n`

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const PROBLEM_EXIT: Partial<Record<ProblemType, ExitCode>> = {
  [ProblemType.VERSION_CONFLICT]: ExitCode.CONFLICT,
  [ProblemType.NOT_FOUND]: ExitCode.NOT_FOUND,
  [ProblemType.INVALID_REQUEST]: ExitCode.USAGE
}

const reportApiError = (error: TaxaApiError, json: boolean, io: CliIo): ExitCode => {
  if (json) io.stdout(`${JSON.stringify(error.problem, undefined, 2)}\n`)
  const hint =
    error.problem.type === ProblemType.UNAUTHENTICATED ? "\nSet TAXA_API_KEY to an API key from taxa add-key." : ""
  const conflictHint =
    error.problem.type === ProblemType.VERSION_CONFLICT ? "\nRun taxa show to see it as it is now, then try again." : ""
  io.stderr(`${error.problem.message}${hint}${conflictHint}\n`)
  return PROBLEM_EXIT[error.problem.type] ?? ExitCode.FAILED
}

const runCommand = async (command: Command, args: string[], server: string, io: CliIo): Promise<ExitCode> => {
  let parsed
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: { ...GLOBAL_OPTIONS, ...command.options } })
  } catch (error) {
    io.stderr(`${messageOf(error)}\n\n${commandUsage(command)}`)
    return ExitCode.USAGE
  }
  if (parsed.values.help) {
    io.stdout(commandUsage(command))
    return ExitCode.OK
  }
  const json = parsed.values.json
  const client = new TaxaClient({
    baseUrl: server,
    apiKey: io.env["TAXA_API_KEY"],
    agentContext: io.env["TAXA_AGENT_CONTEXT"]
  })
  try {
    return await command.run(
      { client, io, json, today: () => dateIn(io.timeZone, io.now()) },
      parsed.values,
      parsed.positionals
    )
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`${error.message}\n\n${commandUsage(command)}`)
      return ExitCode.USAGE
    }
    if (error instanceof TaxaApiError) return reportApiError(error, json, io)
    if (error instanceof TypeError && error.message === "fetch failed") {
      io.stderr(`Can't reach the Taxa server at ${server}.\n`)
      return ExitCode.FAILED
    }
    throw error
  }
}

/** Run one CLI invocation, returning its exit code. */
export const runCli = async (argv: string[], io: CliIo): Promise<ExitCode> => {
  let parsed
  try {
    // A first, lenient pass finds the command and the options every command takes.
    parsed = parseArgs({ args: argv, allowPositionals: true, strict: false, options: GLOBAL_OPTIONS })
  } catch (error) {
    io.stderr(`${messageOf(error)}\n\n${USAGE}`)
    return ExitCode.USAGE
  }
  const [name] = parsed.positionals
  const serverOption = parsed.values.server
  const server =
    (typeof serverOption === "string" ? serverOption : undefined) ?? io.env["TAXA_SERVER"] ?? DEFAULT_SERVER
  if (name === undefined) {
    if (parsed.values.help === true) {
      io.stdout(USAGE)
      return ExitCode.OK
    }
    io.stderr(USAGE)
    return ExitCode.USAGE
  }
  const rest = argv.filter((_arg, index) => index !== argv.indexOf(name))
  if (name === "health") {
    const strict = parseArgs({ args: rest, allowPositionals: false, strict: false, options: GLOBAL_OPTIONS })
    const unknown = Object.keys(strict.values).find((key) => !(key in GLOBAL_OPTIONS))
    if (unknown) {
      io.stderr(`Unknown option '--${unknown}'\n\n${USAGE}`)
      return ExitCode.USAGE
    }
    return healthCommand(server, strict.values.json === true, io)
  }
  const command = COMMANDS.find((candidate) => candidate.name === name)
  if (!command) {
    io.stderr(`Unknown command: ${name}\n\n${USAGE}`)
    return ExitCode.USAGE
  }
  return runCommand(command, rest, server, io)
}
