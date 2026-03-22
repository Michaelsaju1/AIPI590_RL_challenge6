CREATE TABLE "preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" text NOT NULL,
	"prompt" text NOT NULL,
	"chosen" text NOT NULL,
	"rejected" text NOT NULL,
	"preference" text NOT NULL,
	"is_tie" boolean DEFAULT false NOT NULL,
	"prompt_category" text,
	"prompt_id" text,
	"prompt_tags" jsonb,
	"chosen_metadata" jsonb,
	"rejected_metadata" jsonb,
	"reading_time_s" real,
	"user_ip" text,
	"temp_a" real,
	"temp_b" real,
	"scrolled_a" boolean,
	"scrolled_b" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_preferences_prompt_id" ON "preferences" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "idx_preferences_category" ON "preferences" USING btree ("prompt_category");