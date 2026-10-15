-- Verification of restricted organisation types (national public health institutes).
ALTER TABLE "ws_organizations" ADD COLUMN IF NOT EXISTS "type_verification" text DEFAULT 'not_required' NOT NULL;
ALTER TABLE "ws_organizations" ADD COLUMN IF NOT EXISTS "type_verification_method" text;
ALTER TABLE "ws_organizations" ADD COLUMN IF NOT EXISTS "type_verified_by" text;
ALTER TABLE "ws_organizations" ADD COLUMN IF NOT EXISTS "type_verified_at" timestamp with time zone;
ALTER TABLE "ws_organizations" ADD COLUMN IF NOT EXISTS "type_verification_note" text DEFAULT '' NOT NULL;
-- Organisations already registered as NPHIs before verification existed are queued for review.
UPDATE "ws_organizations" SET "type_verification" = 'pending' WHERE "type" = 'nphi' AND "type_verification" = 'not_required';
