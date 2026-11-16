import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { MIGRATIONS_FOLDER, type Database } from "./database.ts"

/** Connects, and brings the schema up to date. */
export const connectPostgres = async (url: string): Promise<Database> => {
  const pool = new pg.Pool({ connectionString: url })
  const db = drizzle(pool)
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return { db, close: () => pool.end() }
}
