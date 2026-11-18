ALTER TABLE "tasks" ADD COLUMN "follows_on_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_follows_on_id_tasks_id_fk" FOREIGN KEY ("follows_on_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_follows_on" ON "tasks" USING btree ("follows_on_id");