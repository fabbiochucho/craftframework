-- Re-review (spec: "Re-review"). Additive: one new table. A funding partner that follows a validation may require
-- one (status 'requested'); the CRAFT programme team opens one or picks up a request and assigns a Senior
-- Validator from a different firm with no ties to the parties. The re-reviewer reads the frozen review and records
-- stands, amended or withdrawn.
-- A challenge to the outcome goes to the Independent Review Panel.
CREATE TABLE IF NOT EXISTS "validation_rereviews" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"reason" text NOT NULL CHECK ("reason" IN ('funder_required', 'flagged', 'programme')),
	"note" text DEFAULT '' NOT NULL,
	"reviewer_email" text,
	"requested_by" text,
	"status" text DEFAULT 'assigned' NOT NULL CHECK ("status" IN ('requested', 'assigned', 'decided')),
	"outcome" text CHECK ("outcome" IN ('stands', 'amended', 'withdrawn')),
	"reasons" text,
	"effects" jsonb,
	"opened_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	-- Only a request may lack a reviewer.
	CHECK ("status" = 'requested' OR ("reviewer_email" IS NOT NULL AND "opened_by" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "validation_rereviews_validation_idx" ON "validation_rereviews" ("validation_id");
CREATE INDEX IF NOT EXISTS "validation_rereviews_reviewer_idx" ON "validation_rereviews" ("reviewer_email");
-- At most one re-review in progress per validation.
CREATE UNIQUE INDEX IF NOT EXISTS "validation_rereviews_one_open" ON "validation_rereviews" ("validation_id") WHERE "status" <> 'decided';
