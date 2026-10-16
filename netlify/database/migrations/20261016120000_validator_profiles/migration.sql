-- Validator system PR 1: validator profiles, credentials, validator firms and
-- funding partners (extending firms), and the organisation directory opt-in.
-- Additive only: existing firms keep kind NULL and behave exactly as before.
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "kind" text;
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "nature" text;
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "summary" text DEFAULT '' NOT NULL;
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "competencies" jsonb DEFAULT '[]' NOT NULL;
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "countries" jsonb DEFAULT '[]' NOT NULL;
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "sectors" jsonb DEFAULT '[]' NOT NULL;
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "ticket_size" text;
ALTER TABLE "firms" DROP CONSTRAINT IF EXISTS "firms_kind_check";
ALTER TABLE "firms" ADD CONSTRAINT "firms_kind_check" CHECK ("kind" IS NULL OR "kind" IN ('validator_firm', 'funding_partner'));
CREATE INDEX IF NOT EXISTS "firms_kind_idx" ON "firms" ("kind");

CREATE TABLE IF NOT EXISTS "validator_profiles" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"competencies" jsonb DEFAULT '[]' NOT NULL,
	"frameworks" jsonb DEFAULT '[]' NOT NULL,
	"countries" jsonb DEFAULT '[]' NOT NULL,
	"languages" jsonb DEFAULT '[]' NOT NULL,
	"accreditation_status" text DEFAULT 'registered' NOT NULL
		CHECK ("accreditation_status" IN ('registered', 'accredited', 'suspended')),
	"accreditation_reason" text,
	"pilot_accredited" boolean DEFAULT false NOT NULL,
	"accreditation_changed_by" text,
	"accreditation_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validator_profiles_suspension_reason" CHECK ("accreditation_status" <> 'suspended' OR coalesce("accreditation_reason", '') <> '')
);

CREATE TABLE IF NOT EXISTS "validator_credentials" (
	"id" text PRIMARY KEY,
	"validator_id" text NOT NULL REFERENCES "validator_profiles"("id") ON DELETE CASCADE,
	"body" text NOT NULL,
	"membership_number" text NOT NULL,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "validator_credentials_validator_idx" ON "validator_credentials" ("validator_id");

CREATE TABLE IF NOT EXISTS "org_directory_profiles" (
	"id" text PRIMARY KEY,
	"org_id" text NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
	"listed" boolean DEFAULT false NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
