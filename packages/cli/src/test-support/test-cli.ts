import { timeZone as zoneNamed, type TimeZone } from "@taxa/shared/dates/plain-date"
import { runCli } from "../cli.ts"
import { DEFAULT_SERVER, type ExitCode } from "../cli-io.ts"
import type { CredentialsFile } from "../credentials/credentials.ts"

export interface CliRun {
  exitCode: ExitCode
  stdout: string
  stderr: string
}

/** Who runs `taxa`: an API key's holder on a server, as the server's test people and agents are. */
export interface CliCaller {
  httpUrl: string
  secret?: string
  /** For agents: TAXA_AGENT_CONTEXT. */
  agentContext?: string
  clock?: { now: () => number }
}

export interface CliRunOptions {
  stdin?: string
  timeZone?: TimeZone
  /** The credentials file, if there's to be one. */
  credentials?: CredentialsFile
  /** More environment, such as TAXA_AS. */
  env?: Record<string, string>
}

/** Runs `taxa` in this process as `caller`, capturing what it prints. */
export const runTaxaAs = async (
  caller: CliCaller,
  argv: string[],
  { stdin = "", timeZone = zoneNamed("Europe/London"), credentials, env = {} }: CliRunOptions = {}
): Promise<CliRun> => {
  let stdout = ""
  let stderr = ""
  const exitCode = await runCli(argv, {
    env: { TAXA_SERVER: caller.httpUrl, TAXA_API_KEY: caller.secret, TAXA_AGENT_CONTEXT: caller.agentContext, ...env },
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    readStdin: () => Promise.resolve(stdin),
    now: () => caller.clock?.now() ?? Date.UTC(2026, 0, 5, 9),
    timeZone,
    readCredentials: () => Promise.resolve(credentials)
  })
  return { exitCode, stdout, stderr }
}

/** Runs `taxa` in this process against `server` with no API key. */
export const runTaxa = (server: string | undefined, ...argv: string[]): Promise<CliRun> =>
  runTaxaAs({ httpUrl: server ?? DEFAULT_SERVER }, argv)
