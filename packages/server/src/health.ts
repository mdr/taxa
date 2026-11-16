import { sql } from "drizzle-orm"
import type { Context } from "hono"
import { HealthStatus, type Health } from "@taxa/shared/api/health"
import type { Database } from "./database/database.ts"
import { LOG_CODES, type LogEvent } from "./telemetry/log.ts"

const databaseUp = async (database: Database, logEvent: LogEvent): Promise<boolean> => {
  try {
    await database.db.execute(sql`select 1`)
    return true
  } catch (error) {
    logEvent(LOG_CODES.health.databaseDown, "the database did not answer", { err: String(error) })
    return false
  }
}

export const healthRoute =
  (database: Database, build: string, logEvent: LogEvent) =>
  async (context: Context): Promise<Response> => {
    const up = await databaseUp(database, logEvent)
    const health: Health = { status: up ? HealthStatus.OK : HealthStatus.DATABASE_DOWN, build }
    return context.json(health, up ? 200 : 503)
  }
