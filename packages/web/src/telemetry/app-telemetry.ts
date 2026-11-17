import { realClock } from "@taxa/shared/clock"
import { createLogger, type Logger } from "@taxa/shared/telemetry/log"
import { loggedAnalytics, type Analytics } from "./analytics.ts"
import type { WebLogCode } from "./codes.ts"
import { consoleDestination } from "./console-destination.ts"

/** The app's log: only the console for now; a destination that sends records to the server can join it. */
export const appLogger: Logger<WebLogCode> = createLogger<WebLogCode>(realClock, [consoleDestination])

export const appAnalytics: Analytics = loggedAnalytics(appLogger)
