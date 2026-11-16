import { sql } from "drizzle-orm"
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"
import type { ActivityType, FieldChange } from "@taxa/shared/activity/activity"
import type { Energy, Priority, TaskStatus } from "@taxa/shared/tasks/task"

// Drizzle's column builder types are too intricate to write out.
// oxlint-disable-next-line typescript/explicit-function-return-type
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" })
// oxlint-disable-next-line typescript/explicit-function-return-type
const plainDate = (name: string) => date(name, { mode: "string" })

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  timeZone: text("time_zone").notNull(),
  defaultDomainId: uuid("default_domain_id"),
  createdAt: instant("created_at").notNull()
})

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  createdAt: instant("created_at").notNull()
})

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  agentId: uuid("agent_id").references(() => agents.id),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  secretHash: text("secret_hash").notNull().unique(),
  createdAt: instant("created_at").notNull(),
  revokedAt: instant("revoked_at")
})

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: instant("created_at").notNull(),
  updatedAt: instant("updated_at").notNull(),
  version: integer("version").notNull(),
  deletedAt: instant("deleted_at")
})

export const domainMembers = pgTable(
  "domain_members",
  {
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id),
    userId: uuid("user_id")
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
    id: uuid("id").primaryKey(),
    number: integer("number")
      .notNull()
      .unique()
      .default(sql`nextval('task_numbers')`),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id),
    title: text("title").notNull(),
    notes: text("notes").notNull(),
    status: text("status").$type<TaskStatus>().notNull(),
    priority: text("priority").$type<Priority>().notNull(),
    inbox: boolean("inbox").notNull(),
    due: plainDate("due"),
    scheduled: plainDate("scheduled"),
    scheduledTime: text("scheduled_time"),
    start: plainDate("start"),
    estimateMinutes: integer("estimate_minutes"),
    energy: text("energy").$type<Energy>(),
    inProgressUserId: uuid("in_progress_user_id").references(() => users.id),
    inProgressAgentId: uuid("in_progress_agent_id").references(() => agents.id),
    inProgressAgentContext: text("in_progress_agent_context"),
    waitingOn: text("waiting_on"),
    followUp: plainDate("follow_up"),
    completedAt: instant("completed_at"),
    cancelledAt: instant("cancelled_at"),
    cancelledReason: text("cancelled_reason"),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
    deletedAt: instant("deleted_at"),
    version: integer("version").notNull()
  },
  (table) => [index("tasks_domain").on(table.domainId)]
)

export const activity = pgTable(
  "activity",
  {
    sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
    at: instant("at").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    agentId: uuid("agent_id").references(() => agents.id),
    agentContext: text("agent_context"),
    entityId: uuid("entity_id").notNull(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id),
    type: text("type").$type<ActivityType>().notNull(),
    changes: jsonb("changes").$type<Record<string, FieldChange>>().notNull()
  },
  (table) => [index("activity_entity").on(table.entityId, table.sequence)]
)

/** Answers already given to requests that carried an Idempotency-Key, so a retry gets the same answer. */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    key: text("key").notNull(),
    createdAt: instant("created_at").notNull(),
    status: integer("status").notNull(),
    body: jsonb("body").notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })]
)
