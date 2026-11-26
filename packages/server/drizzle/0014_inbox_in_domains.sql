ALTER TABLE "tasks" DROP CONSTRAINT "tasks_filed_or_in_an_inbox";--> statement-breakpoint
-- Tasks in an Inbox move into their owner's oldest domain still standing, and stay in the Inbox there.
UPDATE "tasks" SET "domain_id" = (
  SELECT "domains"."id" FROM "domains"
  JOIN "domain_members" ON "domain_members"."domain_id" = "domains"."id"
  WHERE "domain_members"."user_id" = "tasks"."inbox_user_id"
  ORDER BY ("domains"."deleted_at" IS NOT NULL), "domains"."created_at"
  LIMIT 1
) WHERE "domain_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "domain_id" SET NOT NULL;
