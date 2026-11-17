import type { Clock } from "../clock.ts"

export enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG"
}

/** Identifiers and small facts, for finding and cross-referencing events; never what people wrote. */
export type LogFields = Readonly<Record<string, string | number | boolean | undefined>>

export interface LogRecord {
  /** ISO 8601. */
  time: string
  level: LogLevel
  /** `group.event`, unique, what tools match on. */
  code: string
  /** For people reading the log; nothing matches on it. */
  msg: string
  fields: LogFields
}

/** Somewhere records go: the console, standard output, a collector. */
export type LogDestination = (record: LogRecord) => void

/** The codes in a `{ group: { event: "group.event" } }` registry. */
export type CodeIn<Codes extends Record<string, Record<string, string>>> = {
  [Group in keyof Codes]: Codes[Group][keyof Codes[Group]]
}[keyof Codes]

type LogMethod<Code extends string> = (code: Code, msg: string, fields?: LogFields) => void

export interface Logger<Code extends string> {
  error: LogMethod<Code>
  warn: LogMethod<Code>
  info: LogMethod<Code>
  debug: LogMethod<Code>
}

/** A logger that stamps each record with the clock's time and sends it to every destination. */
export const createLogger = <Code extends string>(
  clock: Clock,
  destinations: readonly LogDestination[]
): Logger<Code> => {
  const at =
    (level: LogLevel): LogMethod<Code> =>
    (code, msg, fields = {}) => {
      const record: LogRecord = { time: new Date(clock.now()).toISOString(), level, code, msg, fields }
      for (const destination of destinations) destination(record)
    }
  return { error: at(LogLevel.ERROR), warn: at(LogLevel.WARN), info: at(LogLevel.INFO), debug: at(LogLevel.DEBUG) }
}

/** One flat object, as JSON log lines are written: the record's own keys win over fields of the same name. */
export const flatRecord = ({ time, level, code, msg, fields }: LogRecord): Record<string, unknown> => {
  const own = { time, level, code, msg }
  // Spread twice: the record's keys come first in the line, and win over fields of the same name.
  return { ...own, ...fields, ...own }
}

/** Codes in a registry that aren't `group.event` for the group and event they're filed under. */
export const misfiledCodes = (codes: Record<string, Record<string, string>>): string[] =>
  Object.entries(codes).flatMap(([group, events]) =>
    Object.entries(events)
      .filter(([event, code]) => code !== `${group}.${event}`)
      .map(([, code]) => code)
  )
