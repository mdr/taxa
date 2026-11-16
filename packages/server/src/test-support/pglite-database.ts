import { PGlite, type PGliteInterface } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { MIGRATIONS_FOLDER, type Database } from "../database/database.ts"

const migratedTemplate = async (): Promise<PGlite> => {
  const client = await PGlite.create()
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER })
  return client
}

// Migrated once per test process; each test gets a copy, which is much quicker than migrating again.
let template: Promise<PGlite> | undefined

/** A fresh Postgres inside this process, with the schema in place, for one test. */
export const pgliteDatabase = async (): Promise<Database> => {
  template ??= migratedTemplate()
  const client = (await (await template).clone()) as PGliteInterface as PGlite
  return { db: drizzle(client), close: () => client.close() }
}
