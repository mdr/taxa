import { stringOption, UsageError, type OptionValues } from "../command.ts"

export const VERSION_OPTION = { "if-version": { type: "string" } } as const

export const VERSION_HELP = "  --if-version N         Only if the task is still at version N (exit 3 if not)"

export const ifVersion = (values: OptionValues): number | undefined => {
  const text = stringOption(values, "if-version")
  if (text === undefined) return undefined
  const version = Number(text)
  if (!Number.isInteger(version) || version < 1)
    throw new UsageError(`--if-version must be a version number, not ${JSON.stringify(text)}.`)
  return version
}
