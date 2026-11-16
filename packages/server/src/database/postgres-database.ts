import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import type { Database } from "./database.ts"

export const connectPostgres = (url: string): Database => {
  const pool = new pg.Pool({ connectionString: url })
  return { db: drizzle(pool), close: () => pool.end() }
}
