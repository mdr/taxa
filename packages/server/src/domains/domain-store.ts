import { domainId, type UserId } from "@taxa/shared/ids"
import { and, asc, eq, isNull } from "drizzle-orm"
import type { z } from "zod"
import { ActivityType } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import type { CreateDomainRequestSchema, Domain } from "@taxa/shared/domains/domain"
import { uuidv7 } from "@taxa/shared/ids"
import type { Instant } from "@taxa/shared/units"
import { recordActivity } from "../activity/activity-store.ts"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { domainMembers, domains, tasks } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { callerFields } from "../telemetry/change-fields.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"
import { purgeUncreated } from "../tasks/purging.ts"

type DomainRow = typeof domains.$inferSelect

const domainOf = (row: DomainRow): Domain => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  createdAt: row.createdAt.toISOString(),
  version: row.version
})

/** The domains this person belongs to, oldest first. */
export const domainsOf = async (db: Db, userId: UserId): Promise<Domain[]> => {
  const rows = await db
    .select({ domain: domains })
    .from(domains)
    .innerJoin(domainMembers, eq(domainMembers.domainId, domains.id))
    .where(and(eq(domainMembers.userId, userId), isNull(domains.deletedAt)))
    .orderBy(asc(domains.createdAt), asc(domains.id))
  return rows.map(({ domain }) => domainOf(domain))
}

/** One of this person's domains, named by prefix (any case) or id. */
export const findDomain = async (db: Db, userId: UserId, name: string): Promise<Domain> => {
  const wanted = name.trim()
  const domain = (await domainsOf(db, userId)).find(
    (candidate) => candidate.id === wanted.toLowerCase() || candidate.prefix === wanted.toUpperCase()
  )
  if (!domain) throw new ProblemError(ProblemType.NOT_FOUND, `You have no domain ${JSON.stringify(wanted)}.`)
  return domain
}

export const createDomain = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  request: z.infer<typeof CreateDomainRequestSchema>,
  now: Instant
): Promise<Domain> => {
  const created = await db.transaction(async (tx) => {
    const [taken] = await tx.select().from(domains).where(eq(domains.prefix, request.prefix))
    if (taken) throw new ProblemError(ProblemType.PREFIX_TAKEN, `The prefix ${request.prefix} is already in use.`)
    const at = new Date(now)
    const [row] = await tx
      .insert(domains)
      .values({
        id: request.id ?? domainId(uuidv7(now)),
        name: request.name,
        prefix: request.prefix,
        createdBy: caller.user.id,
        createdAt: at,
        updatedAt: at,
        version: 1
      })
      .returning()
    const domain = domainOf(row!)
    await tx.insert(domainMembers).values({ domainId: domain.id, userId: caller.user.id })
    await recordActivity(tx, caller, now, {
      type: ActivityType.DOMAIN_CREATED,
      entityId: domain.id,
      domainId: domain.id,
      version: 1,
      changes: { name: { to: domain.name }, prefix: { to: domain.prefix } }
    })
    return domain
  })
  log.info(LOG_CODES.domain.created, `domain ${created.prefix} created`, {
    ...callerFields(caller),
    domainId: created.id,
    prefix: created.prefix
  })
  return created
}

/** The most refs a refusal names. */
const NAMED = 5

/**
 * Deletes one of this person's domains, once nothing's filed in it, not even
 * in the Bin. Its prefix stays taken, so its tasks' old refs still find them.
 */
export const deleteDomain = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  name: string,
  now: Instant
): Promise<Domain> => {
  const deleted = await db.transaction(async (tx) => {
    const domain = await findDomain(tx, caller.user.id, name)
    await purgeUncreated(tx, domain.id, now)
    const left = await tx
      .select({ number: tasks.number })
      .from(tasks)
      .where(and(eq(tasks.domainId, domain.id), isNull(tasks.purgedAt)))
      .orderBy(asc(tasks.number))
    if (left.length > 0) {
      const refs = left.slice(0, NAMED).map(({ number }) => `${domain.prefix}-${number}`)
      throw new ProblemError(
        ProblemType.INVALID_REQUEST,
        `${domain.name} still has ${left.length === 1 ? "a task" : `${left.length} tasks`} (${refs.join(", ")}${left.length > NAMED ? ", …" : ""}): move ${left.length === 1 ? "it" : "them"} to another domain, or delete ${left.length === 1 ? "it" : "them"} for good from the Bin, first.`
      )
    }
    const version = domain.version + 1
    await tx
      .update(domains)
      .set({ deletedAt: new Date(now), updatedAt: new Date(now), version })
      .where(eq(domains.id, domain.id))
    await recordActivity(tx, caller, now, {
      type: ActivityType.DOMAIN_DELETED,
      entityId: domain.id,
      domainId: domain.id,
      version,
      changes: { deletedAt: { to: new Date(now).toISOString() } }
    })
    return { ...domain, version }
  })
  log.info(LOG_CODES.domain.deleted, `domain ${deleted.prefix} deleted`, {
    ...callerFields(caller),
    domainId: deleted.id,
    prefix: deleted.prefix
  })
  return deleted
}
