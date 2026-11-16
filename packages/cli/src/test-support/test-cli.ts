import { runCli } from "../cli.ts"
import { DEFAULT_SERVER, type ExitCode } from "../cli-io.ts"

export interface CliRun {
  exitCode: ExitCode
  stdout: string
  stderr: string
}

/** Runs `taxa` in this process against `server`, capturing what it prints. */
export const runTaxa = async (server: string | undefined, ...argv: string[]): Promise<CliRun> => {
  let stdout = ""
  let stderr = ""
  const exitCode = await runCli(argv, {
    env: { TAXA_SERVER: server ?? DEFAULT_SERVER },
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text)
  })
  return { exitCode, stdout, stderr }
}
