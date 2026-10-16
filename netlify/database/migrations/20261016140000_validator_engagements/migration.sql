-- Validator system PR 2: engagements, named teams and independence declarations.
-- Additive only: three new tables, nothing existing is altered. Validator data
-- access reuses access_grants with the new role 'craft_validator' (no schema
-- change; the role is a plain text value).
CREATE TABLE IF NOT EXISTS "validation_engagements" (
	"id" text PRIMARY KEY,
	"framework" text DEFAULT 'capital-readiness' NOT NULL,
	"scope" jsonb DEFAULT '{"kind":"whole"}' NOT NULL,
	"org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"type" text NOT NULL CHECK ("type" IN ('independent_validation', 'funder_review')),
	"created_by" text NOT NULL,
	"created_by_side" text NOT NULL CHECK ("created_by_side" IN ('organization', 'validator', 'funder')),
	"validator_firm_id" text REFERENCES "firms"("id") ON DELETE SET NULL,
	"validator_email" text,
	"funder_firm_id" text REFERENCES "firms"("id") ON DELETE SET NULL,
	"org_status" text DEFAULT 'pending' NOT NULL CHECK ("org_status" IN ('pending', 'accepted', 'declined', 'not_required')),
	"validator_status" text DEFAULT 'pending' NOT NULL CHECK ("validator_status" IN ('pending', 'accepted', 'declined', 'not_required')),
	"funder_status" text DEFAULT 'pending' NOT NULL CHECK ("funder_status" IN ('pending', 'accepted', 'declined', 'not_required')),
	"org_consented_by" text,
	"org_consented_at" timestamp with time zone,
	"declined_side" text,
	"declined_by" text,
	"decline_reason" text,
	"requires_rereview" boolean DEFAULT false NOT NULL,
	"access_days" integer DEFAULT 90 NOT NULL CHECK ("access_days" BETWEEN 1 AND 365),
	"status" text DEFAULT 'proposed' NOT NULL CHECK ("status" IN ('proposed', 'active', 'declined', 'cancelled', 'expired')),
	"invite_expires_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	-- A funder review is the funder's own staff; an independent validation never involves a funder party.
	CONSTRAINT "validation_engagements_shape" CHECK (
		("type" = 'independent_validation' AND "funder_status" = 'not_required' AND "funder_firm_id" IS NULL
			AND "validator_status" <> 'not_required' AND ("validator_firm_id" IS NOT NULL OR "validator_email" IS NOT NULL))
		OR ("type" = 'funder_review' AND "validator_status" = 'not_required' AND "funder_status" <> 'not_required')
	),
	CONSTRAINT "validation_engagements_active_has_expiry" CHECK ("status" <> 'active' OR "expires_at" IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS "validation_engagements_org_idx" ON "validation_engagements" ("org_id");
CREATE INDEX IF NOT EXISTS "validation_engagements_validator_firm_idx" ON "validation_engagements" ("validator_firm_id");
CREATE INDEX IF NOT EXISTS "validation_engagements_funder_firm_idx" ON "validation_engagements" ("funder_firm_id");

CREATE TABLE IF NOT EXISTS "engagement_members" (
	"id" text PRIMARY KEY,
	"engagement_id" text NOT NULL REFERENCES "validation_engagements"("id") ON DELETE CASCADE,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL CHECK ("role" IN ('lead', 'member')),
	-- 'named' | 'declined' | 'removed'
	"status" text DEFAULT 'named' NOT NULL CHECK ("status" IN ('named', 'declined', 'removed')),
	-- Whether the organisation has approved this person being on the team.
	"org_approved" boolean DEFAULT false NOT NULL,
	"added_by" text NOT NULL,
	"grant_id" text,
	"granted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_members_engagement_email_unique" UNIQUE ("engagement_id", "email")
);
CREATE INDEX IF NOT EXISTS "engagement_members_email_idx" ON "engagement_members" ("email");

CREATE TABLE IF NOT EXISTS "engagement_declarations" (
	"id" text PRIMARY KEY,
	"engagement_id" text NOT NULL REFERENCES "validation_engagements"("id") ON DELETE CASCADE,
	"member_email" text NOT NULL,
	"version" text NOT NULL,
	"text" text NOT NULL,
	"funded_disclosure" boolean DEFAULT false NOT NULL,
	"disclosure" text DEFAULT '' NOT NULL,
	"signed_name" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_declarations_unique" UNIQUE ("engagement_id", "member_email", "version"),
	CONSTRAINT "engagement_declarations_disclosure_required" CHECK (NOT "funded_disclosure" OR coalesce("disclosure", '') <> '')
);
