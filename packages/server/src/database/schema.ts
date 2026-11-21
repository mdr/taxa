import { sql } from "drizzle-orm"
import {
  bigserial,
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  check,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn
} from "drizzle-orm/pg-core"
import type { SessionOutcome } from "@taxa/shared/sessions/session"
import type { ActivityType, FieldChange } from "@taxa/shared/activity/activity"
import type { IsoDate, IsoTime, TimeZone } from "@taxa/shared/dates/plain-date"
import type { DomainPrefix } from "@taxa/shared/domains/domain"
import type { AgentId, ApiKeyId, DomainId, SessionId, TaskId, UserId } from "@taxa/shared/ids"
import type { Energy, Horizon, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import type { ActivitySequence, Minutes, Ms, TaskNumber, Version } from "@taxa/shared/units"

// Drizzle's column builder types are too intricate to write out.
// oxlint-disable-next-line typescript/explicit-function-return-type
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" })
// oxlint-disable-next-line typescript/explicit-function-return-type
const plainDate = (name: string) => date(name, { mode: "string" }).$type<IsoDate>()
// oxlint-disable-next-line typescript/explicit-function-return-type
const userId = (name: string) => uuid(name).$type<UserId>()
// oxlint-disable-next-line typescript/explicit-function-return-type
const agentId = (name: string) => uuid(name).$type<AgentId>()
// oxlint-disable-next-line typescript/explicit-function-return-type
const domainId = (name: string) => uuid(name).$type<DomainId>()
// oxlint-disable-next-line typescript/explicit-function-return-type
const version = () => integer("version").$type<Version>().notNull()

export const users = pgTable("users", {
  id: userId("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  timeZone: text("time_zone").$type<TimeZone>().notNull(),
  createdAt: instant("created_at").notNull()
})

export const agents = pgTable("agents", {
  id: agentId("id").primaryKey(),
  ownerId: userId("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  createdAt: instant("created_at").notNull()
})

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").$type<ApiKeyId>().primaryKey(),
  userId: userId("user_id")
    .notNull()
    .references(() => users.id),
  agentId: agentId("agent_id").references(() => agents.id),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  secretHash: text("secret_hash").notNull().unique(),
  createdAt: instant("created_at").notNull(),
  revokedAt: instant("revoked_at")
})

export const domains = pgTable("domains", {
  id: domainId("id").primaryKey(),
  name: text("name").notNull(),
  prefix: text("prefix").$type<DomainPrefix>().notNull().unique(),
  createdBy: userId("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: instant("created_at").notNull(),
  updatedAt: instant("updated_at").notNull(),
  version: version(),
  deletedAt: instant("deleted_at")
})

export const domainMembers = pgTable(
  "domain_members",
  {
    domainId: domainId("domain_id")
      .notNull()
      .references(() => domains.id),
    userId: userId("user_id")
      .notNull()
      .references(() => users.id)
  },
  (table) => [primaryKey({ columns: [table.domainId, table.userId] })]
)

/** Task numbers, global so that a number alone names a task wherever it moves. */
export const taskNumbers = pgSequence("task_numbers")

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").$type<TaskId>().primaryKey(),
    number: integer("number")
      .$type<TaskNumber>()
      .notNull()
      .unique()
      .default(sql`nextval('task_numbers')`),
    /** Where it's filed; while it's in the Inbox, empty, and `inboxUserId` says whose. */
    domainId: domainId("domain_id").references(() => domains.id),
    inboxUserId: userId("inbox_user_id").references(() => users.id),
    title: text("title").notNull(),
    notes: text("notes").notNull(),
    status: text("status").$type<TaskStatus>().notNull(),
    priority: text("priority").$type<Priority>().notNull(),
    due: plainDate("due"),
    scheduled: plainDate("scheduled"),
    scheduledTime: text("scheduled_time").$type<IsoTime>(),
    start: plainDate("start"),
    estimateMinutes: integer("estimate_minutes").$type<Minutes>(),
    energy: text("energy").$type<Energy>(),
    horizon: text("horizon").$type<Horizon>(),
    /** When it was put in its horizon. */
    horizonSetAt: instant("horizon_set_at"),
    /** Labels, in the order they were added. */
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** The task it follows on from. */
    followsOnId: uuid("follows_on_id")
      .$type<TaskId>()
      .references((): AnyPgColumn => tasks.id),
    inProgressUserId: userId("in_progress_user_id").references(() => users.id),
    inProgressAgentId: agentId("in_progress_agent_id").references(() => agents.id),
    inProgressAgentContext: text("in_progress_agent_context"),
    waitingOn: text("waiting_on"),
    followUp: plainDate("follow_up"),
    completedAt: instant("completed_at"),
    cancelledAt: instant("cancelled_at"),
    cancelledReason: text("cancelled_reason"),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
    deletedAt: instant("deleted_at"),
    version: version()
  },
  (table) => [
    index("tasks_domain").on(table.domainId),
    index("tasks_inbox").on(table.inboxUserId),
    index("tasks_follows_on").on(table.followsOnId),
    check("tasks_filed_or_in_an_inbox", sql`(${table.domainId} is null) <> (${table.inboxUserId} is null)`)
  ]
)

export const activity = pgTable(
  "activity",
  {
    sequence: bigserial("sequence", { mode: "number" }).$type<ActivitySequence>().primaryKey(),
    at: instant("at").notNull(),
    userId: userId("user_id")
      .notNull()
      .references(() => users.id),
    agentId: agentId("agent_id").references(() => agents.id),
    agentContext: text("agent_context"),
    /** The task or domain changed. */
    entityId: uuid("entity_id").$type<TaskId | DomainId>().notNull(),
    /** Empty for a task in the Inbox. */
    domainId: domainId("domain_id").references(() => domains.id),
    type: text("type").$type<ActivityType>().notNull(),
    changes: jsonb("changes").$type<Record<string, FieldChange>>().notNull()
  },
  (table) => [index("activity_entity").on(table.entityId, table.sequence)]
)

/** Answers already given to requests that carried an Idempotency-Key, so a retry gets the same answer. */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    userId: userId("user_id")
      .notNull()
      .references(() => users.id),
    key: text("key").notNull(),
    createdAt: instant("created_at").notNull(),
    status: integer("status").notNull(),
    body: jsonb("body").notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })]
)

/** A task planned in a session, as stored: see `SessionItem`. */
export interface StoredSessionItem {
  taskId: TaskId
  minutes: Minutes
  spentMs: Ms
  outcome?: SessionOutcome
}

/** Blocks of time people plan and work through; each has at most one not yet ended. */
/** The order each person means to do a day's tasks in. */
export const dayPlans = pgTable(
  "day_plans",
  {
    userId: userId("user_id")
      .notNull()
      .references(() => users.id),
    date: plainDate("date").notNull(),
    taskIds: jsonb("task_ids").$type<TaskId[]>().notNull(),
    updatedAt: instant("updated_at").notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.date] })]
)

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").$type<SessionId>().primaryKey(),
    userId: userId("user_id")
      .notNull()
      .references(() => users.id),
    startedAt: instant("started_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    items: jsonb("items").$type<StoredSessionItem[]>().notNull(),
    /** The task under way, and since when: both or neither. */
    currentTaskId: uuid("current_task_id").$type<TaskId>(),
    currentSince: instant("current_since"),
    note: text("note").notNull(),
    endedAt: instant("ended_at"),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
    version: version()
  },
  (table) => [
    uniqueIndex("sessions_one_open_each")
      .on(table.userId)
      .where(sql`${table.endedAt} is null`),
    index("sessions_user").on(table.userId, table.startedAt),
    check("sessions_current_whole", sql`(${table.currentTaskId} is null) = (${table.currentSince} is null)`)
  ]
)
