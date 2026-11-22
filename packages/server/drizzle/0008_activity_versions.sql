ALTER TABLE "activity" ADD COLUMN "version" integer;--> statement-breakpoint
-- Each change logged brought its task or domain one version on, from 1 when it was created.
UPDATE "activity" SET "version" = "numbered"."version" FROM (
  SELECT "sequence", row_number() OVER (PARTITION BY "entity_id" ORDER BY "sequence") AS "version" FROM "activity"
) AS "numbered" WHERE "activity"."sequence" = "numbered"."sequence";--> statement-breakpoint
ALTER TABLE "activity" ALTER COLUMN "version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "undoes_version" integer;
