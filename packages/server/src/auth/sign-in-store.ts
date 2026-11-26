import { randomBytes } from "node:crypto"
import { uuidv7 } from "@taxa/shared/ids"
import { and, eq, gt, isNull } from "drizzle-orm"
import type { Instant } from "@taxa/shared/units"
import type { Db } from "../database/database.ts"
import { signIns, users } from "../database/schema.ts"
import { callerUserOf } from "../users/user-store.ts"
import type { CallerUser } from "./caller.ts"
import { hashSecret } from "./secrets.ts"

const DAY_MS = 24 * 60 * 60 * 1000

/** A sign-in lapses once its browser hasn't used it for this long. */
export const SIGN_IN_LAPSES_MS = 30 * DAY_MS

/** How stale its last use may be before it's brought up to date: to spare a write on every request. */
const TOUCH_AFTER_MS = DAY_MS

export interface FoundSignIn {
  id: string
  user: CallerUser
  /** Its last use has just been brought up to date: its cookie should be too. */
  renewed: boolean
}

/** Signs a browser in as a person: the secret goes in its cookie. */
export const startSignIn = async (db: Db, userId: CallerUser["id"], now: Instant): Promise<string> => {
  const secret = randomBytes(32).toString("base64url")
  await db.insert(signIns).values({
    id: uuidv7(now),
    userId,
    secretHash: hashSecret(secret),
    createdAt: new Date(now),
    lastUsedAt: new Date(now)
  })
  return secret
}

/** The person a cookie's secret signs in as, unless it's ended or lapsed. */
export const findSignIn = async (db: Db, secret: string, now: Instant): Promise<FoundSignIn | undefined> => {
  const [found] = await db
    .select({ signIn: signIns, user: users })
    .from(signIns)
    .innerJoin(users, eq(users.id, signIns.userId))
    .where(
      and(
        eq(signIns.secretHash, hashSecret(secret)),
        isNull(signIns.endedAt),
        gt(signIns.lastUsedAt, new Date(now - SIGN_IN_LAPSES_MS))
      )
    )
  if (!found) return undefined
  const renewed = now - found.signIn.lastUsedAt.getTime() >= TOUCH_AFTER_MS
  if (renewed)
    await db
      .update(signIns)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(signIns.id, found.signIn.id))
  return { id: found.signIn.id, user: callerUserOf(found.user), renewed }
}

/** Signs out: the cookie's secret no longer signs in. */
export const endSignIn = async (db: Db, secret: string, now: Instant): Promise<void> => {
  await db
    .update(signIns)
    .set({ endedAt: new Date(now) })
    .where(and(eq(signIns.secretHash, hashSecret(secret)), isNull(signIns.endedAt)))
}
