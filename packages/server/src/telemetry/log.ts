/** Every event the server logs, as `group.event`. */
export const LOG_CODES = {
  server: {
    started: "server.started"
  },
  health: {
    databaseDown: "health.databaseDown"
  },
  request: {
    failed: "request.failed"
  }
} as const

type LogCode = {
  [Group in keyof typeof LOG_CODES]: (typeof LOG_CODES)[Group][keyof (typeof LOG_CODES)[Group]]
}[keyof typeof LOG_CODES]

export type LogFields = Record<string, string | number | boolean | undefined>

export type LogEvent = (code: LogCode, msg: string, fields?: LogFields) => void

/** One flat JSON line per event, on standard output. */
export const logToStdout: LogEvent = (code, msg, fields = {}) => {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), code, msg, ...fields })}\n`)
}
