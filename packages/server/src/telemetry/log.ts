import { flatRecord, type CodeIn, type LogDestination, type Logger } from "@taxa/shared/telemetry/log"

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
  },
  user: {
    created: "user.created"
  },
  agent: {
    created: "agent.created"
  },
  apiKey: {
    created: "apiKey.created",
    revoked: "apiKey.revoked"
  },
  domain: {
    created: "domain.created"
  },
  session: {
    created: "session.created",
    changed: "session.changed",
    ended: "session.ended"
  },
  task: {
    created: "task.created",
    updated: "task.updated",
    statusChanged: "task.statusChanged",
    deleted: "task.deleted",
    restored: "task.restored"
  }
} as const

export type ServerLogCode = CodeIn<typeof LOG_CODES>

export type ServerLogger = Logger<ServerLogCode>

/** One flat JSON line per record, on standard output. */
export const stdoutDestination: LogDestination = (record) => {
  process.stdout.write(`${JSON.stringify(flatRecord(record))}\n`)
}
