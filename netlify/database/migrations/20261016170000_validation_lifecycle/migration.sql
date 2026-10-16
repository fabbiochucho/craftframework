-- Validator system PR 5: validity, statuses, material events, follow-ups and reminders.
-- Additive only: four new tables, nothing existing is altered.
CREATE TABLE IF NOT EXISTS "validations" (
	"id" text PRIMARY KEY,
	"review_id" text NOT NULL UNIQUE REFERENCES "validation_reviews"("id") ON DELETE CASCADE,
	"engagement_id" text NOT NULL REFERENCES "validation_engagements"("id") ON DELETE CASCADE,
	"org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"framework" text NOT NULL,
	"outcome" text NOT NULL CHECK ("outcome" IN ('validated', 'validated_with_qualifications')),
	"validated_rung" integer NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"validity_months" integer NOT NULL CHECK ("validity_months" BETWEEN 1 AND 24),
	"validity_reason" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"surveillance_due_at" timestamp with time zone,
	"surveillance_done_at" timestamp with time zone,
	-- Indicators a follow-up re-checks: the qualified ones plus those blocking the next rung.
	"tracked_indicators" jsonb DEFAULT '[]' NOT NULL,
	"follow_up_mode" text DEFAULT 'milestone' NOT NULL CHECK ("follow_up_mode" IN ('milestone', 'fixed_3', 'fixed_6', 'end_of_plan')),
	"follow_up_set_by" text,
	"follow_up_set_at" timestamp with time zone,
	-- Stored decisions only; 'follow-up overdue' and 'expired' follow the calendar.
	"status" text DEFAULT 'current' NOT NULL CHECK ("status" IN ('current', 'suspended', 'withdrawn', 'superseded')),
	"status_reason" text,
	"status_changed_at" timestamp with time zone,
	"status_changed_by" text,
	"superseded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "validations_org_idx" ON "validations" ("org_id", "framework");
CREATE INDEX IF NOT EXISTS "validations_engagement_idx" ON "validations" ("engagement_id");

CREATE TABLE IF NOT EXISTS "validation_events" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"event_key" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"occurred_on" date NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_by" text NOT NULL,
	-- 'organization' (the organisation reporting) | 'programme' (the CRAFT programme team)
	"reported_by_side" text NOT NULL CHECK ("reported_by_side" IN ('organization', 'programme')),
	"deadline_on" date NOT NULL,
	"late" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open', 'reinstated', 're_scoped', 'withdrawn')),
	"org_response" text DEFAULT '' NOT NULL,
	"org_responded_at" timestamp with time zone,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text DEFAULT '' NOT NULL
);
CREATE INDEX IF NOT EXISTS "validation_events_validation_idx" ON "validation_events" ("validation_id");

CREATE TABLE IF NOT EXISTS "validation_follow_ups" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"due_on" date NOT NULL,
	-- 'confirmed' | 'concerns'
	"result" text NOT NULL CHECK ("result" IN ('confirmed', 'concerns')),
	"note" text DEFAULT '' NOT NULL,
	"completed_by" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_follow_ups_due_unique" UNIQUE ("validation_id", "due_on")
);

-- Reminder log: one row per (validation, kind, point, offset, recipient) so the daily job is idempotent.
CREATE TABLE IF NOT EXISTS "validation_notifications" (
	"id" serial PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"kind" text NOT NULL CHECK ("kind" IN ('follow_up', 'expiry', 'surveillance')),
	"due_on" date NOT NULL,
	"offset_days" integer NOT NULL,
	"recipient" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_notifications_unique" UNIQUE ("validation_id", "kind", "due_on", "offset_days", "recipient")
);
