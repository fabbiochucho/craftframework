-- Validator system PR 6: public verification page, statement PDF and "report a concern".
-- Additive only: two columns on validations (nullable / defaulted) and two new tables.
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "verification_id" text;
ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "public_options" jsonb DEFAULT '{}' NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "validations_verification_id_unique" ON "validations" ("verification_id") WHERE "verification_id" IS NOT NULL;

-- The issued statement PDF, generated once. Its SHA-256 is what the public page shows.
CREATE TABLE IF NOT EXISTS "validation_statements" (
	"validation_id" text PRIMARY KEY REFERENCES "validations"("id") ON DELETE CASCADE,
	"pdf_base64" text NOT NULL,
	"sha256" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Concerns raised from the public verification page. Heard by the Review Panel in a later PR.
CREATE TABLE IF NOT EXISTS "validation_concerns" (
	"id" text PRIMARY KEY,
	"validation_id" text NOT NULL REFERENCES "validations"("id") ON DELETE CASCADE,
	"category" text NOT NULL CHECK ("category" IN ('inaccurate', 'conduct', 'material_event', 'other')),
	"message" text NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL CHECK ("status" IN ('new', 'in_review', 'closed')),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_by" text,
	"handled_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "validation_concerns_validation_idx" ON "validation_concerns" ("validation_id");
