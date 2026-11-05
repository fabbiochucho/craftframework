-- Where a government assessment applies (state or region, district or local government area), so one body can assess
-- several places for the same module and year, and results can be grouped by place. Empty means the whole body.
ALTER TABLE "cca_assessments" ADD COLUMN IF NOT EXISTS "region" text DEFAULT '' NOT NULL;
ALTER TABLE "cca_assessments" ADD COLUMN IF NOT EXISTS "district" text DEFAULT '' NOT NULL;
ALTER TABLE "cca_assessments" DROP CONSTRAINT IF EXISTS "cca_assessments_one_per_year";
ALTER TABLE "cca_assessments" ADD CONSTRAINT "cca_assessments_one_per_year" UNIQUE ("org_id", "module", "year", "award_ref", "region", "district");
