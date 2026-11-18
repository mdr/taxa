CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"items" jsonb NOT NULL,
	"current_task_id" uuid,
	"current_since" timestamp with time zone,
	"note" text NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "sessions_current_whole" CHECK (("sessions"."current_task_id" is null) = ("sessions"."current_since" is null))
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_one_open_each" ON "sessions" USING btree ("user_id") WHERE "sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id","started_at");