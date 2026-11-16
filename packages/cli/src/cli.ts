import { parseArgs } from "node:util"
import { DEFAULT_SERVER, ExitCode, type CliIo } from "./cli-io.ts"
import { healthCommand } from "./health-command.ts"

const USAGE = `Usage: taxa <command> [--json] [--server URL]

Commands:
  health    Whether the server and its database are up

The server comes from --server, else TAXA_SERVER, else ${DEFAULT_SERVER}.
`

/** Run one CLI invocation, returning its exit code. */
export const runCli = async (argv: string[], io: CliIo): Promise<ExitCode> => {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { json: { type: "boolean", default: false }, server: { type: "string" } }
    })
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`)
    return ExitCode.USAGE
  }
  const server = parsed.values.server ?? io.env["TAXA_SERVER"] ?? DEFAULT_SERVER
  const [command] = parsed.positionals
  if (command === "health") return healthCommand(server, parsed.values.json, io)
  io.stderr(command === undefined ? USAGE : `Unknown command: ${command}\n\n${USAGE}`)
  return ExitCode.USAGE
}
