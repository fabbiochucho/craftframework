-- Validator system: CIP follow-up actions, funder consent, status history and checkpoints,
-- plus the debrief-opened notice marker. Additive: one nullable column and four new tables.
-- Existing validations are backfilled: an "issued" history row (and the current decision, if it
-- is not 'current'), their completed follow-ups and surveillance as checkpoints.
ALTER TABLE "validation_reviews" ADD COLUMN IF NOT EXISTS "debrief_notified_at" timestamp with time zone;

-- The organisation's improvement actions for a validation: owner, due date, and proof it was done.
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
	-- A done action always has an owner, a due date and proof.
	CONSTRAINT "validation_cip_actions_done_complete" CHECK (
		"status" <> 'done' OR (coalesce("owner", '') <> '' AND "due_date" IS NOT NULL AND char_length(trim("proof")) >= 3 AND "done_at" IS NOT NULL)
	)
);
CREATE INDEX IF NOT EXISTS "validation_cip_actions_validation_idx" ON "validation_cip_actions" ("validation_id");
CREATE INDEX IF NOT EXISTS "validation_cip_actions_org_idx" ON "validation_cip_actions" ("org_id");

-- The organisation lets a funding partner see schedule and progress (counts, dates, status), nothing more.
CREATE TABLE IF NOT EXISTS "validation_funder_consents" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"funder_firm_id" text NOT NULL REFERENCES "firms"("id") ON DELETE CASCADE,
	"granted_by" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	CONSTRAINT "validation_funder_consents_unique" UNIQUE ("validation_id", "funder_firm_id")
);
CREATE INDEX IF NOT EXISTS "validation_funder_consents_firm_idx" ON "validation_funder_consents" ("funder_firm_id");

-- Every change of the shown status, in order: issue, decisions, supersession, and the calendar (expired, overdue).
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

-- The follow-up and surveillance points of a validation. At most one pending point per kind.
CREATE TABLE IF NOT EXISTS "validation_checkpoints" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"kind" text NOT NULL CHECK ("kind" IN ('surveillance', 'follow_up')),
	"due_on" date NOT NULL,
	"indicator_ids" jsonb DEFAULT '[]' NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL CHECK ("state" IN ('pending', 'done')),
	"result" text CHECK ("result" IS NULL OR "result" IN ('confirmed', 'concerns')),
	"note" text DEFAULT '' NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_checkpoints_unique" UNIQUE ("validation_id", "kind", "due_on"),
	CONSTRAINT "validation_checkpoints_done_complete" CHECK ("state" <> 'done' OR ("done_at" IS NOT NULL AND "done_by" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "validation_checkpoints_validation_idx" ON "validation_checkpoints" ("validation_id");

-- Backfill from what the lifecycle PR already recorded.
INSERT INTO "validation_status_history" ("id", "validation_id", "from_status", "to_status", "reason", "actor", "created_at")
SELECT 'vsh_issued_' || "id", "id", NULL, 'current', 'Validation issued', 'system', "issued_at" FROM "validations"
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "validation_status_history" ("id", "validation_id", "from_status", "to_status", "reason", "actor", "created_at")
SELECT 'vsh_now_' || "id", "id", 'current', "status", coalesce("status_reason", ''), coalesce("status_changed_by", 'system'), coalesce("status_changed_at", "issued_at")
FROM "validations" WHERE "status" <> 'current'
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "validation_checkpoints" ("id", "validation_id", "kind", "due_on", "indicator_ids", "state", "result", "note", "done_at", "done_by")
SELECT 'cp_fu_' || "id", "validation_id", 'follow_up', "due_on", '[]', 'done', "result", "note", "completed_at", "completed_by" FROM "validation_follow_ups"
ON CONFLICT DO NOTHING;
INSERT INTO "validation_checkpoints" ("id", "validation_id", "kind", "due_on", "indicator_ids", "state", "done_at", "done_by")
SELECT 'cp_sv_' || "id", "id", 'surveillance', "surveillance_due_at"::date, "tracked_indicators",
  CASE WHEN "surveillance_done_at" IS NULL THEN 'pending' ELSE 'done' END,
  "surveillance_done_at", CASE WHEN "surveillance_done_at" IS NULL THEN NULL ELSE 'system' END
FROM "validations" WHERE "surveillance_due_at" IS NOT NULL
ON CONFLICT DO NOTHING;
