-- Super Admin analytics and resume-onboarding nudges. Additive: seven new tables, no existing table is altered.

-- Where each person got to in /onboarding. Step numbers and names only; never the form contents.
CREATE TABLE IF NOT EXISTS "onboarding_progress" (
	"email" text PRIMARY KEY,
	"step" integer NOT NULL CHECK ("step" BETWEEN 1 AND 3),
	"step_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

-- Every 'finish setting up' email a Super Admin sent (or tried to send).
CREATE TABLE IF NOT EXISTS "onboarding_nudges" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"sent_by" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"step" integer NOT NULL,
	"step_name" text NOT NULL,
	"has_note" boolean DEFAULT false NOT NULL,
	-- 'pending' | 'accepted' | 'failed' | 'not_configured'
	"outcome" text DEFAULT 'pending' NOT NULL CHECK ("outcome" IN ('pending', 'accepted', 'failed', 'not_configured'))
);
CREATE INDEX IF NOT EXISTS "onboarding_nudges_email_idx" ON "onboarding_nudges" ("email", "sent_at");

-- People who used the signed 'stop these reminders' link.
CREATE TABLE IF NOT EXISTS "onboarding_optouts" (
	"email" text PRIMARY KEY,
	"opted_out_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One row per day a signed-in person was seen (written when they sign in), so activity has history
-- beyond users.last_seen_at which only keeps the latest sign-in.
CREATE TABLE IF NOT EXISTS "daily_active" (
	"day" date NOT NULL,
	"email" text NOT NULL,
	PRIMARY KEY ("day", "email")
);

-- Outcome of every transactional email, by type. No recipient, no content.
CREATE TABLE IF NOT EXISTS "email_log" (
	"id" serial PRIMARY KEY,
	"kind" text NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "email_log_created_idx" ON "email_log" ("created_at");

-- Directory searches, aggregated for the Super Admin. No user id is stored.
CREATE TABLE IF NOT EXISTS "directory_search_log" (
	"id" serial PRIMARY KEY,
	"type" text NOT NULL,
	"query" text NOT NULL,
	"result_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "directory_search_log_created_idx" ON "directory_search_log" ("created_at");

-- Profile views per day (counts only; who looked is not recorded).
CREATE TABLE IF NOT EXISTS "directory_profile_views" (
	"kind" text NOT NULL,
	"profile_id" text NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	PRIMARY KEY ("kind", "profile_id", "day")
);
