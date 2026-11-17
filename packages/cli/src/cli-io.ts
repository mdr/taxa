import type { TimeZone } from "@taxa/shared/dates/plain-date"
import type { Instant } from "@taxa/shared/units"

/** What a CLI run reads and writes, so tests can run it in-process. */
export interface CliIo {
  env: Record<string, string | undefined>
  stdout: (text: string) => void
  stderr: (text: string) => void
  /** Everything piped in, for commands that take JSON. */
  readStdin: () => Promise<string>
  now: () => Instant
  /** Where "today" and "friday" are worked out. */
  timeZone: TimeZone
}

/** What `taxa` exits with, so scripts and agents can tell outcomes apart. */
export enum ExitCode {
  OK = 0,
  FAILED = 1,
  USAGE = 2,
  /** The task changed since the version given with --if-version. */
  CONFLICT = 3,
  NOT_FOUND = 4
}

export const DEFAULT_SERVER = "http://localhost:8787"
