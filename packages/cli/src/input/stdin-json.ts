import type { z } from "zod"
import type { CliIo } from "../cli-io.ts"
import { UsageError } from "../command.ts"

/** The JSON piped in, checked against the schema. */
export const readStdinJson = async <T extends z.ZodType>(io: CliIo, schema: T, what: string): Promise<z.output<T>> => {
  const text = await io.readStdin()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new UsageError(`Expected ${what} as JSON on stdin, but it isn't JSON.`)
  }
  const result = schema.safeParse(json)
  if (!result.success)
    throw new UsageError(
      `The JSON on stdin isn't ${what}: ${result.error.issues.map((issue) => `${issue.path.join(".") || "(top)"}: ${issue.message}`).join("; ")}`
    )
  return result.data
}

/** `-` in place of the arguments means "read JSON from stdin". */
export const STDIN = "-"
