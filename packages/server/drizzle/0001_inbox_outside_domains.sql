-- The Inbox moves out of domains: a task is either filed in a domain or in one person's Inbox, the one who made it.
ALTER TABLE "tasks" ADD COLUMN "inbox_user_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_inbox_user_id_users_id_fk" FOREIGN KEY ("inbox_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "domain_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "tasks" SET "inbox_user_id" = coalesce(
  (SELECT "user_id" FROM "activity" WHERE "activity"."entity_id" = "tasks"."id" AND "activity"."type" = 'TASK_CREATED' ORDER BY "sequence" LIMIT 1),
  (SELECT "created_by" FROM "domains" WHERE "domains"."id" = "tasks"."domain_id")
), "domain_id" = NULL WHERE "inbox";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "inbox";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_filed_or_in_an_inbox" CHECK (("tasks"."domain_id" is null) <> ("tasks"."inbox_user_id" is null));--> statement-breakpoint
CREATE INDEX "tasks_inbox" ON "tasks" USING btree ("inbox_user_id");--> statement-breakpoint
ALTER TABLE "activity" ALTER COLUMN "domain_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "default_domain_id";
