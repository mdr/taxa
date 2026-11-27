import { ProblemType } from "@taxa/shared/api/problem"
import type { TaxaApiError } from "@taxa/shared/api/taxa-client"
import { ExitCode, type CliIo } from "./cli-io.ts"
import type { Style } from "./format/style.ts"

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
export const reportApiError = (error: TaxaApiError, json: boolean, io: CliIo, style: Style): ExitCode => {
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
