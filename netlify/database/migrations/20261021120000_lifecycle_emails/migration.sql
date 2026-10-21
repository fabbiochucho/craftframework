-- Lifecycle email programme (2-week nudge, 1-month feedback, milestones, check-ins) and the in-app survey.
-- Additive: new tables only. Nothing here changes an existing table or row.

-- One row per lifecycle email (sent, being sent, failed, or recorded as skipped so it is never looked at again).
-- idempotency_key is `lifecycle-<userId>-<kind>-<occurrence>`: each kind/occurrence exists once per recipient.
CREATE TABLE IF NOT EXISTS "lifecycle_emails" (
	"id" text PRIMARY KEY,
	"idempotency_key" text NOT NULL UNIQUE,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"org_id" text NOT NULL,
	"kind" text NOT NULL CHECK ("kind" IN ('nudge_2w', 'feedback_1m', 'milestone', 'checkin')),
	"occurrence" integer NOT NULL,
	"variant" text NOT NULL DEFAULT 'default',
	"outcome" text NOT NULL DEFAULT 'pending' CHECK ("outcome" IN ('pending', 'accepted', 'failed', 'not_configured', 'skipped')),
	"skip_reason" text,
	"attempts" integer NOT NULL DEFAULT 0,
	"subject" text NOT NULL DEFAULT '',
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"sent_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "lifecycle_emails_email_idx" ON "lifecycle_emails" ("email", "sent_at");
CREATE INDEX IF NOT EXISTS "lifecycle_emails_kind_idx" ON "lifecycle_emails" ("kind", "occurrence");
-- One celebration per organisation per milestone, whoever it was sent to. A failed or skipped row frees the slot.
CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_emails_org_milestone_uq" ON "lifecycle_emails" ("org_id", "occurrence")
	WHERE "kind" = 'milestone' AND "outcome" NOT IN ('failed', 'skipped');

-- The two categories a person can switch off independently. A timestamp means opted out (and since when).
CREATE TABLE IF NOT EXISTS "lifecycle_preferences" (
	"email" text PRIMARY KEY,
	"checkins_opted_out_at" timestamp with time zone,
	"celebrations_opted_out_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Single-row server-side switches. paused = the Super Admin's pause-all; the scheduler checks it on every run.
CREATE TABLE IF NOT EXISTS "lifecycle_settings" (
	"id" text PRIMARY KEY CHECK ("id" = 'global'),
	"paused" boolean NOT NULL DEFAULT false,
	"updated_by" text,
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- The first Capital Readiness Ladder rung observed for an organisation, so a milestone can say 'from rung 2 to rung 4'.
CREATE TABLE IF NOT EXISTS "lifecycle_org_baselines" (
	"org_id" text PRIMARY KEY,
	"start_rung" integer NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Responses to the in-app feedback survey (/feedback/<token>). One per person per survey occurrence.
CREATE TABLE IF NOT EXISTS "survey_responses" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"org_id" text,
	"occurrence" text NOT NULL,
	"lifecycle_email_id" text,
	"nps" integer NOT NULL CHECK ("nps" BETWEEN 0 AND 10),
	"ease" integer NOT NULL CHECK ("ease" BETWEEN 1 AND 5),
	"used_most" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"improve" text NOT NULL DEFAULT '',
	"wants_call" boolean NOT NULL DEFAULT false,
	"call_times" text NOT NULL DEFAULT '',
	"call_notified_at" timestamp with time zone,
	"call_handled_at" timestamp with time zone,
	"call_handled_by" text,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	UNIQUE ("email", "occurrence")
);
CREATE INDEX IF NOT EXISTS "survey_responses_created_idx" ON "survey_responses" ("created_at");
