import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

/** The database the app talks to: Postgres in development and production, PGlite in tests. */
export interface Database {
  readonly db: PgDatabase<PgQueryResultHKT>
  close(): Promise<void>
}
