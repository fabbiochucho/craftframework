-- Validator system PR 7: ratings and feedback on a validator by the parties to a finalised engagement.
-- Additive: one new table. One rating per party (organisation, funding partner) per engagement.
-- A rating is attached to the lead validator and firm as they were when the engagement finished, so a
-- later change of firm never moves feedback. Removed ratings keep their row (and the reason) for the record.
CREATE TABLE IF NOT EXISTS "validation_ratings" (
	"id" text PRIMARY KEY,
	"engagement_id" text NOT NULL REFERENCES "validation_engagements"("id") ON DELETE CASCADE,
	"validation_id" text REFERENCES "validations"("id") ON DELETE SET NULL,
	"org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"party" text NOT NULL CHECK ("party" IN ('organisation', 'funder')),
	"rater_email" text NOT NULL,
	"validator_email" text NOT NULL,
	"validator_firm_id" text REFERENCES "firms"("id") ON DELETE SET NULL,
	"stars" integer NOT NULL CHECK ("stars" BETWEEN 1 AND 5),
	"comment" text DEFAULT '' NOT NULL CHECK (char_length("comment") <= 2000),
	"reply" text DEFAULT '' NOT NULL CHECK (char_length("reply") <= 2000),
	"reply_by" text,
	"reply_at" timestamp with time zone,
	"status" text DEFAULT 'published' NOT NULL CHECK ("status" IN ('published', 'removed')),
	"removed_by" text,
	"removed_at" timestamp with time zone,
	"removal_ground" text CHECK ("removal_ground" IS NULL OR "removal_ground" IN ('false', 'abusive', 'personal_data', 'not_a_party')),
	"removal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_ratings_one_per_party" UNIQUE ("engagement_id", "party"),
	-- A removal always records who, when, on what ground and why.
	CONSTRAINT "validation_ratings_removed_complete" CHECK (
		"status" <> 'removed' OR ("removed_by" IS NOT NULL AND "removed_at" IS NOT NULL AND "removal_ground" IS NOT NULL AND char_length(trim(coalesce("removal_reason", ''))) >= 3)
	)
);
CREATE INDEX IF NOT EXISTS "validation_ratings_validator_idx" ON "validation_ratings" ("validator_email");
CREATE INDEX IF NOT EXISTS "validation_ratings_firm_idx" ON "validation_ratings" ("validator_firm_id");
