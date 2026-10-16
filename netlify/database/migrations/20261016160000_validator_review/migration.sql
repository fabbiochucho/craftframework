-- Validator system PR 3: review, Trust Delta, debrief, outcome and freeze.
-- New tables only, plus ONE constraint change: validation_engagements.status
-- now also allows 'finalised' (a loosening; no existing row is affected).
ALTER TABLE "validation_engagements" DROP CONSTRAINT IF EXISTS "validation_engagements_status_check";
ALTER TABLE "validation_engagements" ADD CONSTRAINT "validation_engagements_status_check"
	CHECK ("status" IN ('proposed', 'active', 'declined', 'cancelled', 'expired', 'finalised'));

CREATE TABLE IF NOT EXISTS "validation_reviews" (
	"id" text PRIMARY KEY,
	"engagement_id" text NOT NULL UNIQUE REFERENCES "validation_engagements"("id") ON DELETE CASCADE,
	"method" text CHECK ("method" IS NULL OR "method" IN ('document_review', 'sample_testing', 'interviews', 'site_visit', 'combined')),
	"fieldwork_start" date,
	"fieldwork_end" date,
	-- 'draft' | 'debrief' | 'finalised'
	"status" text DEFAULT 'draft' NOT NULL CHECK ("status" IN ('draft', 'debrief', 'finalised')),
	"outcome" text CHECK ("outcome" IS NULL OR "outcome" IN ('validated', 'validated_with_qualifications', 'not_validated')),
	"outcome_summary" text DEFAULT '' NOT NULL,
	"validated_rung" integer,
	"snapshot" jsonb,
	"snapshot_sha256" text,
	"finalised_at" timestamp with time zone,
	"finalised_by" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_reviews_finalised_complete" CHECK (
		"status" <> 'finalised' OR ("outcome" IS NOT NULL AND "snapshot" IS NOT NULL AND "snapshot_sha256" IS NOT NULL AND "finalised_at" IS NOT NULL)
	)
);

CREATE TABLE IF NOT EXISTS "validation_scores" (
	"review_id" text NOT NULL REFERENCES "validation_reviews"("id") ON DELETE CASCADE,
	"indicator_id" text NOT NULL,
	"score" integer NOT NULL CHECK ("score" BETWEEN 0 AND 5),
	"sufficiency" text DEFAULT 'sufficient' NOT NULL CHECK ("sufficiency" IN ('sufficient', 'partial', 'insufficient')),
	"comment" text DEFAULT '' NOT NULL,
	"evidence_ref" text DEFAULT '' NOT NULL,
	"scored_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("review_id", "indicator_id")
);

CREATE TABLE IF NOT EXISTS "validation_debriefs" (
	"review_id" text NOT NULL REFERENCES "validation_reviews"("id") ON DELETE CASCADE,
	"indicator_id" text NOT NULL,
	"org_response" text DEFAULT '' NOT NULL,
	"responded_by" text,
	"responded_at" timestamp with time zone,
	"negotiated_score" integer CHECK ("negotiated_score" IS NULL OR "negotiated_score" BETWEEN 0 AND 5),
	"negotiated_by" text,
	"negotiated_at" timestamp with time zone,
	PRIMARY KEY ("review_id", "indicator_id")
);

CREATE TABLE IF NOT EXISTS "validation_qualifications" (
	"id" text PRIMARY KEY,
	"review_id" text NOT NULL REFERENCES "validation_reviews"("id") ON DELETE CASCADE,
	"text" text NOT NULL,
	"indicator_ids" jsonb DEFAULT '[]' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "validation_qualifications_review_idx" ON "validation_qualifications" ("review_id");
