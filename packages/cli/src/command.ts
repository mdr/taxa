import type { ParseArgsOptionsConfig } from "node:util"
import type { TaxaClient } from "@taxa/shared/api/taxa-client"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { CliIo, ExitCode } from "./cli-io.ts"

export type OptionValues = Record<string, string | boolean | (string | boolean)[] | undefined>

export interface CommandContext {
  client: TaxaClient
  io: CliIo
  /** --json: print what the API answered, for machines. */
  json: boolean
  today: () => IsoDate
}

export interface Command {
  name: string
  /** One line, for the command list. */
  summary: string
  /** The arguments after the command's name, e.g. `<ref> [--reason TEXT]`. */
  usage: string
  options: ParseArgsOptionsConfig
  run: (context: CommandContext, values: OptionValues, positionals: string[]) => Promise<ExitCode>
}

/** Thrown for a mistake in how the command was called; the CLI prints it with the command's usage. */
export class UsageError extends Error {}

export const stringOption = (values: OptionValues, name: string): string | undefined => {
  const value = values[name]
  return typeof value === "string" ? value : undefined
}

export const oneArgument = (positionals: string[], what: string): string => {
  const [argument, ...rest] = positionals
  if (argument === undefined) throw new UsageError(`Say which ${what}.`)
  if (rest.length > 0) throw new UsageError(`Expected one ${what}, got ${positionals.length}: ${positionals.join(" ")}`)
  return argument
}

/** Prints the API's answer as JSON with --json, or else as people read it. */
export const print = (context: CommandContext, data: unknown, human: () => string): void => {
  context.io.stdout(context.json ? `${JSON.stringify(data, undefined, 2)}\n` : `${human()}\n`)
}
