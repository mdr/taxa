CREATE TABLE "occurrences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"date" date NOT NULL,
	"outcome" text NOT NULL,
	"on" date NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"agent_context" text,
	"task_version" integer NOT NULL,
	"voided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "repeat" jsonb;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "occurrences_task_date" ON "occurrences" USING btree ("task_id","date") WHERE "occurrences"."voided_at" is null;