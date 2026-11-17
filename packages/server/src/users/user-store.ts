import type { TimeZone } from "@taxa/shared/dates/plain-date"
import { userId as newUserId, type UserId } from "@taxa/shared/ids"
import { eq } from "drizzle-orm"
import { uuidv7 } from "@taxa/shared/ids"
import type { Instant } from "@taxa/shared/units"
import type { CallerUser } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { users } from "../database/schema.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"

type UserRow = typeof users.$inferSelect

export const callerUserOf = (row: UserRow): CallerUser => ({
  id: row.id,
  name: row.name,
  timeZone: row.timeZone
})

export const createUser = async (
  db: Db,
  log: ServerLogger,
  name: string,
  timeZone: TimeZone,
  now: Instant
): Promise<CallerUser> => {
  const [row] = await db
    .insert(users)
    .values({ id: newUserId(uuidv7(now)), name, timeZone, createdAt: new Date(now) })
    .returning()
  const user = callerUserOf(row!)
  log.info(LOG_CODES.user.created, "person created", { userId: user.id })
  return user
}

export const userById = async (db: Db, id: UserId): Promise<CallerUser | undefined> => {
  const [row] = await db.select().from(users).where(eq(users.id, id))
  return row && callerUserOf(row)
}

/** The development login's person, made the first time. */
export const ensureUserNamed = async (
  db: Db,
  log: ServerLogger,
  name: string,
  timeZone: TimeZone,
  now: Instant
): Promise<CallerUser> => {
  const [row] = await db.select().from(users).where(eq(users.name, name))
  return row ? callerUserOf(row) : createUser(db, log, name, timeZone, now)
}
