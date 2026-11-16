import { serve } from "@hono/node-server"
import { z } from "zod"
import { realClock } from "@taxa/shared/clock"
import { createApp } from "./app.ts"
import { configFrom, type Config } from "./config.ts"
import { connectPostgres } from "./database/postgres-database.ts"
import { LOG_CODES, logToStdout } from "./telemetry/log.ts"

const readConfig = (): Config => {
  try {
    return configFrom(process.env)
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error
    console.error(`The server's environment isn't right:\n${z.prettifyError(error)}`)
    process.exit(1)
  }
}

const config = readConfig()
const database = connectPostgres(config.DATABASE_URL)
const app = createApp({ database, clock: realClock, build: config.TAXA_BUILD, logEvent: logToStdout })

serve({ fetch: app.fetch, port: config.PORT }, ({ port }) =>
  logToStdout(LOG_CODES.server.started, "listening", { port, build: config.TAXA_BUILD })
)
