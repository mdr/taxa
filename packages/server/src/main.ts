import { serve } from "@hono/node-server"
import { z } from "zod"
import { realClock } from "@taxa/shared/clock"
import { createApp } from "./app.ts"
import { clearOldBin } from "./tasks/task-purge.ts"
import { configFrom, type Config } from "./config.ts"
import { connectPostgres } from "./database/postgres-database.ts"
import { createLogger } from "@taxa/shared/telemetry/log"
import { LOG_CODES, stdoutDestination, type ServerLogCode } from "./telemetry/log.ts"

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
const logger = createLogger<ServerLogCode>(realClock, [stdoutDestination])
const database = await connectPostgres(config.DATABASE_URL)
const app = await createApp({
  database,
  clock: realClock,
  build: config.TAXA_BUILD,
  logger,
  devLogin: config.TAXA_DEV_USER ? { name: config.TAXA_DEV_USER, timeZone: config.TAXA_TIME_ZONE } : undefined
})

serve({ fetch: app.fetch, port: config.PORT }, ({ port }) =>
  logger.info(LOG_CODES.server.started, "listening", {
    port,
    build: config.TAXA_BUILD,
    devLogin: config.TAXA_DEV_USER !== undefined
  })
)

/** How often tasks left in the bin too long are deleted for good. */
const CLEAR_BIN_EVERY_MS = 24 * 60 * 60 * 1000

const clearBin = (): void => {
  clearOldBin(database.db, logger, realClock.now()).catch((error: unknown) =>
    logger.error(LOG_CODES.bin.clearFailed, "couldn't clear old tasks out of the bin", { err: String(error) })
  )
}
clearBin()
setInterval(clearBin, CLEAR_BIN_EVERY_MS)
