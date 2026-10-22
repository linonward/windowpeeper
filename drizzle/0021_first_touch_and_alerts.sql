CREATE TABLE "alert" (
	"kind" text PRIMARY KEY NOT NULL,
	"sent_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_referrer" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_utm_source" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_utm_medium" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_utm_campaign" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_utm_term" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_utm_content" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_landing_path" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_locale" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_seen_at" timestamp;