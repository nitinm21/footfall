CREATE TABLE "site_usage" (
	"token" text NOT NULL,
	"day" text NOT NULL,
	"received" integer DEFAULT 0 NOT NULL,
	"dropped" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "site_usage_token_day_pk" PRIMARY KEY("token","day")
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "first_event_at" timestamp with time zone;