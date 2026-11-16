import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import type { Database } from "../database/database.ts"

/** A fresh, empty Postgres inside this process, for one test. */
export const pgliteDatabase = async (): Promise<Database> => {
  const client = await PGlite.create()
  return { db: drizzle(client), close: () => client.close() }
}
