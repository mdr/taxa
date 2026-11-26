import { parseArgs, type ParseArgsOptionsConfig } from "node:util"
import { ProblemType } from "@taxa/shared/api/problem"
import { TaxaApiError, TaxaClient } from "@taxa/shared/api/taxa-client"
import { dateIn } from "@taxa/shared/dates/plain-date"
import { DEFAULT_SERVER, DEFAULT_WEB, ExitCode, type CliIo } from "./cli-io.ts"
import { ACCOUNT_COMMANDS } from "./commands/account-commands.ts"
import { STATUS_COMMANDS } from "./commands/status-commands.ts"
import { TASK_COMMANDS } from "./commands/task-commands.ts"
import { TAG_COMMANDS } from "./commands/tag-commands.ts"
import { COMMENT_COMMANDS } from "./commands/comment-commands.ts"
import { CHECKLIST_COMMANDS } from "./commands/checklist-commands.ts"
import { UsageError, type Command } from "./command.ts"
import { healthCommand } from "./health-command.ts"
import { colorChoiceOf, PLAIN, styleFor, type Style } from "./format/style.ts"
import { connectionFrom, CredentialsError, parseCredentials, type Connection } from "./credentials/credentials.ts"

const COMMANDS: Command[] = [
  ...TASK_COMMANDS,
  ...CHECKLIST_COMMANDS,
  ...COMMENT_COMMANDS,
  ...TAG_COMMANDS,
  ...STATUS_COMMANDS,
  ...ACCOUNT_COMMANDS
]

const GLOBAL_OPTIONS = {
  json: { type: "boolean", default: false },
  server: { type: "string" },
  as: { type: "string" },
  color: { type: "string" },
  help: { type: "boolean", short: "h", default: false }
} satisfies ParseArgsOptionsConfig

const width = Math.max(...COMMANDS.map(({ name }) => name.length), "health".length)

const USAGE = `Usage: taxa <command> [arguments] [--json] [--server URL] [--as NAME] [--color WHEN]

Commands:
${COMMANDS.map(({ name, summary }) => `  ${name.padEnd(width)}  ${summary}`).join("\n")}
  ${"health".padEnd(width)}  Whether the server and its database are up

A task is named by its reference (H-142), its number (142) or its id.
taxa <command> --help says more about a command.

In a terminal, taxa marks and colours what it prints, and cuts lines to fit;
piped or redirected, it prints plain text. --color auto|always|never says
otherwise, as do NO_COLOR and FORCE_COLOR. --json prints the API's JSON. Exit codes: 0 OK, 1 failed, 2 bad usage,
3 the task changed since --if-version, 4 not found.

Environment:
  TAXA_SERVER         The server (default ${DEFAULT_SERVER}); --server overrides it
  TAXA_WEB            The web app, for links to tasks (default ${DEFAULT_WEB})
  TAXA_API_KEY        Your API key, or your agent's
  TAXA_AGENT_CONTEXT  For agents: what you're working on, recorded with your changes
  TAXA_AS             Which identity in the credentials file to act as; --as overrides it
  TAXA_CREDENTIALS    The credentials file (default ~/.config/taxa/credentials)

The credentials file holds keys for you and your agents, readable only by
you (chmod 600). Without --as, TAXA_API_KEY or TAXA_AS, taxa acts as [default]:

  server = http://localhost:8787
  web = http://localhost:5173

  [default]
  key = taxa_…

  [claude-code]
  key = taxa_…
`

const commandUsage = ({ name, summary, usage }: Command): string => `${summary}.\n\nUsage: taxa ${name} ${usage}\n`

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const PROBLEM_EXIT: Partial<Record<ProblemType, ExitCode>> = {
  [ProblemType.VERSION_CONFLICT]: ExitCode.CONFLICT,
  [ProblemType.NOT_FOUND]: ExitCode.NOT_FOUND,
  [ProblemType.INVALID_REQUEST]: ExitCode.USAGE
}

const PROBLEM_HINT: Partial<Record<ProblemType, string>> = {
  [ProblemType.UNAUTHENTICATED]:
    "Set TAXA_API_KEY to an API key from taxa add-key, or put it in the credentials file (taxa --help).",
  [ProblemType.VERSION_CONFLICT]: "Run taxa show to see it as it is now, then try again.",
  [ProblemType.NOT_FOUND]: "taxa list finds tasks; taxa list --search WORDS, by what they say."
}

/** What went wrong, and what to try; styled, a cross in red and the hint dimmed. */
const reportApiError = (error: TaxaApiError, json: boolean, io: CliIo, style: Style): ExitCode => {
  if (json) io.stdout(`${JSON.stringify(error.problem, undefined, 2)}\n`)
  const hint = PROBLEM_HINT[error.problem.type]
  // The not-found hint is new, and only for people: agents' and scripts' output stays as it was.
  const shownHint =
    hint !== undefined && (style.styled || error.problem.type !== ProblemType.NOT_FOUND) ? hint : undefined
  const message = style.styled ? style.red(`✗ ${error.problem.message}`) : error.problem.message
  io.stderr(
    `${message}${shownHint === undefined ? "" : `\n${style.styled ? `  ${style.dim(shownHint)}` : shownHint}`}\n`
  )
  return PROBLEM_EXIT[error.problem.type] ?? ExitCode.FAILED
}

const runCommand = async (
  command: Command,
  args: string[],
  connect: () => Promise<Connection>,
  io: CliIo
): Promise<ExitCode> => {
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
  let style: Style
  try {
    style = json ? PLAIN : styleFor(colorChoiceOf(parsed.values.color), io.env, io.terminal)
  } catch (error) {
    io.stderr(`${messageOf(error)}\n\n${commandUsage(command)}`)
    return ExitCode.USAGE
  }
  const { server, apiKey, web } = await connect()
  const client = new TaxaClient({
    baseUrl: server,
    apiKey,
    agentContext: io.env["TAXA_AGENT_CONTEXT"],
    timeZone: () => io.timeZone
  })
  try {
    return await command.run(
      { client, io, json, web, today: () => dateIn(io.timeZone, io.now()), style },
      parsed.values,
      parsed.positionals
    )
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`${error.message}\n\n${commandUsage(command)}`)
      return ExitCode.USAGE
    }
    if (error instanceof TaxaApiError) return reportApiError(error, json, io, style)
    if (error instanceof TypeError && error.message === "fetch failed") {
      io.stderr(`Can't reach the Taxa server at ${server}.\n`)
      return ExitCode.FAILED
    }
    throw error
  }
}

/** Runs `run`, reporting a credentials file it can't use. */
const withCredentials = async (io: CliIo, run: () => Promise<ExitCode>): Promise<ExitCode> => {
  try {
    return await run()
  } catch (error) {
    if (!(error instanceof CredentialsError)) throw error
    io.stderr(`${error.message}\n`)
    return ExitCode.FAILED
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
  const { server, as } = parsed.values
  const connect = async (): Promise<Connection> => {
    const file = await io.readCredentials()
    return connectionFrom(
      { server: typeof server === "string" ? server : undefined, as: typeof as === "string" ? as : undefined },
      io.env,
      file && parseCredentials(file),
      { server: DEFAULT_SERVER, web: DEFAULT_WEB }
    )
  }
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
    return withCredentials(io, async () => healthCommand((await connect()).server, strict.values.json === true, io))
  }
  const command = COMMANDS.find((candidate) => candidate.name === name)
  if (!command) {
    io.stderr(`Unknown command: ${name}\n\n${USAGE}`)
    return ExitCode.USAGE
  }
  return withCredentials(io, () => runCommand(command, rest, connect, io))
}
