import { createLogger, type LogRecord, type Logger } from "@taxa/shared/telemetry/log"
import { FakeClock } from "@taxa/shared/test-support/fake-clock"
import { loggedAnalytics, type Analytics } from "../telemetry/analytics.ts"
import type { WebLogCode } from "../telemetry/codes.ts"

export interface TestTelemetry {
  logger: Logger<WebLogCode>
  analytics: Analytics
  /** Everything logged or tracked, in order. */
  records: LogRecord[]
  /** Each record as its code and fields, for comparing. */
  tracked: () => [string, LogRecord["fields"]][]
}

/** A logger and analytics that keep what they're given, for tests to look at. */
export const testTelemetry = (): TestTelemetry => {
  const records: LogRecord[] = []
  const logger = createLogger<WebLogCode>(new FakeClock(0), [(record) => records.push(record)])
  return {
    logger,
    analytics: loggedAnalytics(logger),
    records,
    tracked: () => records.map(({ code, fields }) => [code, fields])
  }
}
