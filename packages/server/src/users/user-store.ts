import { eq } from "drizzle-orm"
import { uuidv7 } from "@taxa/shared/ids"
import type { Instant } from "@taxa/shared/units"
import type { CallerUser } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { users } from "../database/schema.ts"

type UserRow = typeof users.$inferSelect

export const callerUserOf = (row: UserRow): CallerUser => ({
  id: row.id,
  name: row.name,
  timeZone: row.timeZone,
  defaultDomainId: row.defaultDomainId ?? undefined
})

export const createUser = async (db: Db, name: string, timeZone: string, now: Instant): Promise<CallerUser> => {
  const [row] = await db
    .insert(users)
    .values({ id: uuidv7(now), name, timeZone, createdAt: new Date(now) })
    .returning()
  return callerUserOf(row!)
}

export const userById = async (db: Db, id: string): Promise<CallerUser | undefined> => {
  const [row] = await db.select().from(users).where(eq(users.id, id))
  return row && callerUserOf(row)
}

/** The development login's person, made the first time. */
export const ensureUserNamed = async (db: Db, name: string, timeZone: string, now: Instant): Promise<CallerUser> => {
  const [row] = await db.select().from(users).where(eq(users.name, name))
  return row ? callerUserOf(row) : createUser(db, name, timeZone, now)
}

export const setDefaultDomain = async (db: Db, userId: string, domainId: string): Promise<void> => {
  await db.update(users).set({ defaultDomainId: domainId }).where(eq(users.id, userId))
}
