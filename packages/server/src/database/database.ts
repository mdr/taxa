import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

/** What queries run against: the database, or a transaction in it. */
export type Db = PgDatabase<PgQueryResultHKT>

/** The database the app talks to: Postgres in development and production, PGlite in tests. */
export interface Database {
  readonly db: Db
  close(): Promise<void>
}

export const MIGRATIONS_FOLDER = new URL("../../drizzle", import.meta.url).pathname
