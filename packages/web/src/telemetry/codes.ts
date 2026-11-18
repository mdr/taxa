import type { CodeIn } from "@taxa/shared/telemetry/log"

/** What the app logs about itself, as `group.event`. */
export const LOG_CODES = {
  app: {
    started: "app.started",
    uncaughtError: "app.uncaughtError",
    unhandledRejection: "app.unhandledRejection"
  },
  api: {
    requestFailed: "api.requestFailed"
  },
  task: {
    changeRefused: "task.changeRefused"
  }
} as const

/** What people do, as `group.event`: each also goes to the log. */
export const ANALYTICS_CODES = {
  nav: {
    pageOpened: "nav.pageOpened"
  },
  onboarding: {
    finished: "onboarding.finished"
  },
  domain: {
    created: "domain.created"
  },
  task: {
    captured: "task.captured",
    changed: "task.changed",
    undone: "task.undone",
    refCopied: "task.refCopied",
    followOnAdded: "task.followOnAdded"
  },
  list: {
    completedShown: "list.completedShown",
    searched: "list.searched"
  },
  shortcut: {
    used: "shortcut.used",
    singleKeysSet: "shortcut.singleKeysSet"
  },
  shortcutsHelp: {
    opened: "shortcutsHelp.opened"
  },
  commandMenu: {
    opened: "commandMenu.opened",
    commandRun: "commandMenu.commandRun",
    taskOpened: "commandMenu.taskOpened"
  },
  notes: {
    modeSwitched: "notes.modeSwitched"
  },
  session: {
    started: "session.started",
    taskFinished: "session.taskFinished",
    taskStarted: "session.taskStarted",
    timeAdded: "session.timeAdded",
    replanned: "session.replanned",
    ended: "session.ended",
    noteSaved: "session.noteSaved",
    finishUndone: "session.finishUndone"
  },
  today: {
    taskPlanned: "today.taskPlanned"
  }
} as const

export type AnalyticsCode = CodeIn<typeof ANALYTICS_CODES>

export type WebLogCode = CodeIn<typeof LOG_CODES> | AnalyticsCode
