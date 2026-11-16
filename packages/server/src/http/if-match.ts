import { ProblemType } from "@taxa/shared/api/problem"
import { ProblemError } from "./problem-error.ts"

const VERSION = /^(?:W\/)?"?(\d+)"?$/

/** The version an If-Match header names, if it names one. */
export const ifMatchVersion = (header: string | undefined): number | undefined => {
  if (header === undefined) return undefined
  const version = VERSION.exec(header.trim())?.[1]
  if (version === undefined)
    throw new ProblemError(ProblemType.INVALID_REQUEST, `If-Match should be a version, like "3".`)
  return Number(version)
}
