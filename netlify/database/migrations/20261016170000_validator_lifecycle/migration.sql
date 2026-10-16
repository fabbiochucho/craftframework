-- Validator system PR 5: validity, statuses, material events and CIP follow-up.
-- Additive only: six new tables and ONE new nullable column on validation_reviews
-- (debrief_notified_at). Nothing existing is dropped, renamed or tightened.
ALTER TABLE "validation_reviews" ADD COLUMN IF NOT EXISTS "debrief_notified_at" timestamp with time zone;

-- One row per finalised review: the issued validation, its public verification id,
-- validity, status and follow-up schedule. The frozen result itself stays in
-- validation_reviews.snapshot; nothing here can alter it.
CREATE TABLE IF NOT EXISTS "validations" (
	"id" text PRIMARY KEY,
	"review_id" text NOT NULL UNIQUE REFERENCES "validation_reviews"("id") ON DELETE CASCADE,
	"engagement_id" text NOT NULL UNIQUE REFERENCES "validation_engagements"("id") ON DELETE CASCADE,
	"org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"framework" text NOT NULL,
	"verification_id" text NOT NULL UNIQUE,
	"outcome" text NOT NULL CHECK ("outcome" IN ('validated', 'validated_with_qualifications', 'not_validated')),
	"validated_rung" integer,
	"issued_at" timestamp with time zone NOT NULL,
	-- 0 for a "not validated" outcome (no validity); otherwise the months issued.
	"validity_months" integer NOT NULL CHECK ("validity_months" >= 0),
	-- 'standard' | 'extended' | 'shorter'
	"validity_choice" text DEFAULT 'standard' NOT NULL CHECK ("validity_choice" IN ('standard', 'extended', 'shorter')),
	"validity_reason" text DEFAULT '' NOT NULL,
	"surveillance" boolean DEFAULT false NOT NULL,
	-- Only ever moves EARLIER after issue (shortened, or a missed surveillance check). Null = no validity.
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'current' NOT NULL CHECK ("status" IN ('current', 'follow_up_overdue', 'suspended', 'expired', 'withdrawn', 'superseded')),
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_reason" text,
	"superseded_by" text,
	"scope_note" text DEFAULT '' NOT NULL,
	"follow_up_kind" text DEFAULT 'milestone' NOT NULL CHECK ("follow_up_kind" IN ('milestone', 'fixed_3', 'fixed_6', 'end_of_plan')),
	"follow_up_validator_ok" boolean DEFAULT false NOT NULL,
	"follow_up_org_ok" boolean DEFAULT false NOT NULL,
	-- Indicators a follow-up re-checks: the qualified and blocking ones.
	"follow_up_indicators" jsonb DEFAULT '[]' NOT NULL,
	"funder_cip_consent" boolean DEFAULT false NOT NULL,
	"funder_cip_consent_by" text,
	"funder_cip_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validations_validity_shape" CHECK (
		("outcome" = 'not_validated' AND "expires_at" IS NULL AND "validity_months" = 0)
		OR ("outcome" <> 'not_validated' AND "expires_at" IS NOT NULL AND "validity_months" > 0)
	),
	CONSTRAINT "validations_withdrawn_reason" CHECK ("status" <> 'withdrawn' OR coalesce("withdrawn_reason", '') <> '')
);
CREATE INDEX IF NOT EXISTS "validations_org_idx" ON "validations" ("org_id", "framework");
CREATE INDEX IF NOT EXISTS "validations_status_idx" ON "validations" ("status");

-- Full status history (append-only by convention; nothing updates or deletes it).
CREATE TABLE IF NOT EXISTS "validation_status_history" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "validation_status_history_validation_idx" ON "validation_status_history" ("validation_id", "created_at");

-- Verification points: the surveillance check at month 12 of a 24-month validity, and follow-up checks.
CREATE TABLE IF NOT EXISTS "validation_checkpoints" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"kind" text NOT NULL CHECK ("kind" IN ('surveillance', 'follow_up')),
	"due_at" timestamp with time zone NOT NULL,
	"indicator_ids" jsonb DEFAULT '[]' NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL CHECK ("state" IN ('pending', 'done')),
	-- 'confirmed' | 'not_confirmed' once done
	"result" text CHECK ("result" IS NULL OR "result" IN ('confirmed', 'not_confirmed')),
	"note" text DEFAULT '' NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_checkpoints_done_complete" CHECK ("state" <> 'done' OR ("result" IS NOT NULL AND "done_at" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "validation_checkpoints_validation_idx" ON "validation_checkpoints" ("validation_id");

-- One reminder per (point, threshold): the unique key makes the daily run idempotent.
CREATE TABLE IF NOT EXISTS "validation_reminders" (
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	-- 'expiry' or a checkpoint id
	"point" text NOT NULL,
	"days_before" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("validation_id", "point", "days_before")
);

CREATE TABLE IF NOT EXISTS "material_events" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"event_type" text NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"description" text NOT NULL,
	"occurred_on" date NOT NULL,
	"reported_by" text NOT NULL,
	-- 'organization' | 'programme_team'
	"reported_by_side" text NOT NULL CHECK ("reported_by_side" IN ('organization', 'programme_team')),
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report_due" date NOT NULL,
	"late" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL CHECK ("status" IN ('pending_review', 'reinstated', 're_scoped', 'withdrawn')),
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"resolution_note" text DEFAULT '' NOT NULL,
	"org_response" text DEFAULT '' NOT NULL,
	"org_responded_by" text,
	"org_responded_at" timestamp with time zone,
	-- A disagreement goes to the Independent Review Panel (cases are built in PR 7).
	"contested_at" timestamp with time zone,
	"contested_by" text,
	"contest_reason" text DEFAULT '' NOT NULL
);
CREATE INDEX IF NOT EXISTS "material_events_validation_idx" ON "material_events" ("validation_id", "status");

-- The follow-up plan: CIP actions with owner, due date and proof-of-done evidence.
CREATE TABLE IF NOT EXISTS "validation_cip_actions" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"text" text NOT NULL,
	"indicator_ids" jsonb DEFAULT '[]' NOT NULL,
	"owner" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open', 'done')),
	"proof" text DEFAULT '' NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" text,
	"qualification_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_cip_actions_done_has_proof" CHECK ("status" <> 'done' OR (coalesce("proof", '') <> '' AND "done_at" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "validation_cip_actions_validation_idx" ON "validation_cip_actions" ("validation_id");
CREATE INDEX IF NOT EXISTS "validation_cip_actions_org_idx" ON "validation_cip_actions" ("org_id");
