import { LogLevel, type LogDestination } from "@taxa/shared/telemetry/log"

const METHOD: Record<LogLevel, "error" | "warn" | "info" | "debug"> = {
  [LogLevel.ERROR]: "error",
  [LogLevel.WARN]: "warn",
  [LogLevel.INFO]: "info",
  [LogLevel.DEBUG]: "debug"
}

/** The browser's console, at the record's level, so its filters work. */
export const consoleDestination: LogDestination = ({ level, code, msg, fields }) => {
  console[METHOD[level]](`${code}: ${msg}`, fields)
}
