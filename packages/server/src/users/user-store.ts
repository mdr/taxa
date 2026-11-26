import type { TimeZone } from "@taxa/shared/dates/plain-date"
import { userId as newUserId, type UserId } from "@taxa/shared/ids"
import { and, eq, isNull } from "drizzle-orm"
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

/** A person's now in another time zone. */
export const moveUserTo = async (
  db: Db,
  log: ServerLogger,
  user: CallerUser,
  timeZone: TimeZone
): Promise<CallerUser> => {
  await db.update(users).set({ timeZone }).where(eq(users.id, user.id))
  log.info(LOG_CODES.user.movedTimeZone, "person moved time zone", {
    userId: user.id,
    from: user.timeZone,
    to: timeZone
  })
  return { ...user, timeZone }
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

/** The person with this email, which is lower case, if Taxa knows them. */
export const userByEmail = async (db: Db, email: string): Promise<CallerUser | undefined> => {
  const [row] = await db.select().from(users).where(eq(users.email, email))
  return row && callerUserOf(row)
}

/**
 * Makes sure each person who may sign in is known by their email: someone of
 * that name with no email yet, such as the development login's person, takes
 * it; otherwise they're made.
 */
export const ensurePeople = async (
  db: Db,
  log: ServerLogger,
  people: { name: string; email: string }[],
  timeZone: TimeZone,
  now: Instant
): Promise<void> => {
  for (const { name, email } of people) {
    if (await userByEmail(db, email)) continue
    const [unclaimed] = await db
      .select()
      .from(users)
      .where(and(eq(users.name, name), isNull(users.email)))
    const user = unclaimed ? callerUserOf(unclaimed) : await createUser(db, log, name, timeZone, now)
    await db.update(users).set({ email }).where(eq(users.id, user.id))
    log.info(LOG_CODES.user.maySignIn, "person may sign in", { userId: user.id })
  }
}
