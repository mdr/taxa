import type { LogFields, Logger } from "@taxa/shared/telemetry/log"
import type { AnalyticsCode, WebLogCode } from "./codes.ts"

/** Significant things people do in the app, with the ids involved; never what they typed. */
export interface Analytics {
  track: (code: AnalyticsCode, msg: string, fields?: LogFields) => void
}

/** Analytics that go to the log, at info. */
export const loggedAnalytics = (logger: Logger<WebLogCode>): Analytics => ({
  track: (code, msg, fields) => logger.info(code, msg, fields)
})
