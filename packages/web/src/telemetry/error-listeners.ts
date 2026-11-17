import type { Logger } from "@taxa/shared/telemetry/log"
import { LOG_CODES, type WebLogCode } from "./codes.ts"

/** Logs errors nothing else caught; the returned function stops listening. */
export const logUncaughtErrors = (target: Window, logger: Logger<WebLogCode>): (() => void) => {
  const uncaught = (event: ErrorEvent): void =>
    logger.error(LOG_CODES.app.uncaughtError, "an error went uncaught", { err: String(event.error ?? event.message) })
  const unhandled = (event: PromiseRejectionEvent): void =>
    logger.error(LOG_CODES.app.unhandledRejection, "a promise was rejected and nothing handled it", {
      err: String(event.reason)
    })
  target.addEventListener("error", uncaught)
  target.addEventListener("unhandledrejection", unhandled)
  return () => {
    target.removeEventListener("error", uncaught)
    target.removeEventListener("unhandledrejection", unhandled)
  }
}
