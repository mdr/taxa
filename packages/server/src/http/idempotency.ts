import { and, eq } from "drizzle-orm"
import type { Context } from "hono"
import { IDEMPOTENCY_KEY_HEADER } from "@taxa/shared/api/problem"
import type { Instant } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { idempotencyKeys } from "../database/schema.ts"

/**
 * Runs `create` once per Idempotency-Key: a retry with the same key gets the
 * first answer back instead of creating something again.
 */
export const onceFor = async <T>(
  db: Db,
  context: Context,
  caller: Caller,
  now: Instant,
  create: () => Promise<T>
): Promise<T> => {
  const key = context.req.header(IDEMPOTENCY_KEY_HEADER)?.slice(0, 200)
  if (!key) return create()
  const mine = and(eq(idempotencyKeys.userId, caller.user.id), eq(idempotencyKeys.key, key))
  const [seen] = await db.select().from(idempotencyKeys).where(mine)
  if (seen) return seen.body as T
  const result = await create()
  await db
    .insert(idempotencyKeys)
    .values({ userId: caller.user.id, key, createdAt: new Date(now), status: 201, body: result })
    .onConflictDoNothing()
  return result
}
