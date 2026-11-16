/** What a CLI run reads and writes, so tests can run it in-process. */
export interface CliIo {
  env: Record<string, string | undefined>
  stdout: (text: string) => void
  stderr: (text: string) => void
}

export enum ExitCode {
  OK = 0,
  FAILED = 1,
  USAGE = 2
}

export const DEFAULT_SERVER = "http://localhost:8787"
