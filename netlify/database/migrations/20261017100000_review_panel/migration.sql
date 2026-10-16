-- Validator system PR 7b: the Independent Review Panel. Additive: four new tables.
-- A new panel per case (one convenor + two reviewers from a volunteer roster), written responses from both
-- sides, a majority decision with written reasons, and one appeal to a fresh panel.

-- Volunteers who may be asked to sit: Senior Validators, or an outside chartered accountant / auditor.
CREATE TABLE IF NOT EXISTS "panel_roster" (
	"email" text PRIMARY KEY,
	"name" text NOT NULL,
	"kind" text NOT NULL CHECK ("kind" IN ('senior_validator', 'external_auditor')),
	"note" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "panel_cases" (
	"id" text PRIMARY KEY,
	"kind" text NOT NULL CHECK ("kind" IN ('validation_dispute', 'validator_complaint', 'contested_event', 're_review_challenge', 'feedback_complaint')),
	"status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open', 'responses', 'deliberating', 'decided')),
	"raised_by" text NOT NULL,
	"raised_side" text NOT NULL CHECK ("raised_side" IN ('organisation', 'funder', 'validator', 'programme')),
	"summary" text NOT NULL CHECK (char_length(trim("summary")) >= 10 AND char_length("summary") <= 4000),
	"validation_id" text REFERENCES "validations"("id") ON DELETE SET NULL,
	"engagement_id" text REFERENCES "validation_engagements"("id") ON DELETE SET NULL,
	"org_id" text REFERENCES "organizations"("id") ON DELETE SET NULL,
	"rating_id" text REFERENCES "validation_ratings"("id") ON DELETE SET NULL,
	"event_id" text REFERENCES "validation_events"("id") ON DELETE SET NULL,
	"concern_id" text REFERENCES "validation_concerns"("id") ON DELETE SET NULL,
	-- The validator the case is about (lead of the engagement, or the one rated).
	"subject_validator_email" text,
	"appeal_of" text REFERENCES "panel_cases"("id") ON DELETE SET NULL,
	"appeal_reason" text,
	"convened_at" timestamp with time zone,
	"respond_by" date,
	"decide_by" date,
	"decision" jsonb,
	"decision_reasons" text,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"decided_late" boolean DEFAULT false NOT NULL,
	"appeal_by" date,
	-- What applying the decision changed, for the record.
	"effects" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	-- A decided case always has a decision, written reasons, and when and by whom.
	CONSTRAINT "panel_cases_decided_complete" CHECK (
		"status" <> 'decided' OR ("decision" IS NOT NULL AND char_length(trim(coalesce("decision_reasons", ''))) >= 20 AND "decided_at" IS NOT NULL AND "decided_by" IS NOT NULL)
	),
	-- A case that has a panel has its clock.
	CONSTRAINT "panel_cases_clock" CHECK ("status" = 'open' OR ("convened_at" IS NOT NULL AND "respond_by" IS NOT NULL AND "decide_by" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "panel_cases_validation_idx" ON "panel_cases" ("validation_id");
CREATE INDEX IF NOT EXISTS "panel_cases_status_idx" ON "panel_cases" ("status");
-- One appeal per case.
CREATE UNIQUE INDEX IF NOT EXISTS "panel_cases_one_appeal" ON "panel_cases" ("appeal_of") WHERE "appeal_of" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "panel_members" (
	"id" text PRIMARY KEY,
	"case_id" text NOT NULL REFERENCES "panel_cases"("id") ON DELETE CASCADE,
	"email" text NOT NULL,
	"role" text NOT NULL CHECK ("role" IN ('convenor', 'reviewer')),
	"status" text DEFAULT 'invited' NOT NULL CHECK ("status" IN ('invited', 'accepted', 'declined')),
	-- The signed statement that they have no conflict, and what the server's own conflict check found.
	"declaration" text,
	"declined_reason" text,
	"responded_at" timestamp with time zone,
	"vote" jsonb,
	"vote_reasons" text,
	"voted_at" timestamp with time zone,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "panel_members_case_email_unique" UNIQUE ("case_id", "email"),
	CONSTRAINT "panel_members_accepted_declared" CHECK ("status" <> 'accepted' OR char_length(trim(coalesce("declaration", ''))) >= 3)
);
CREATE INDEX IF NOT EXISTS "panel_members_email_idx" ON "panel_members" ("email");

-- Written responses with evidence references, from each side, while the case is open to them.
CREATE TABLE IF NOT EXISTS "panel_submissions" (
	"id" text PRIMARY KEY,
	"case_id" text NOT NULL REFERENCES "panel_cases"("id") ON DELETE CASCADE,
	"side" text NOT NULL CHECK ("side" IN ('organisation', 'validator', 'funder', 'other')),
	"author" text NOT NULL,
	"text" text NOT NULL CHECK (char_length(trim("text")) >= 3 AND char_length("text") <= 8000),
	"evidence_ref" text DEFAULT '' NOT NULL CHECK (char_length("evidence_ref") <= 1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "panel_submissions_case_idx" ON "panel_submissions" ("case_id");
