-- An award can point at a funder's own grant on CRAFT (funder_programmes), and each of an organisation's assessments
-- (CRAFT-ONC, the 5-tier wizard, each Capacity Assessment) can be linked to one of its awards.
ALTER TABLE "awards" ADD COLUMN IF NOT EXISTS "funder_firm_id" text;
ALTER TABLE "awards" ADD COLUMN IF NOT EXISTS "funder_grant_id" text;
CREATE TABLE IF NOT EXISTS "assessment_links" (
  "org_id" text NOT NULL,
  "assessment" text NOT NULL,
  "award_id" text NOT NULL,
  "linked_by" text NOT NULL,
  "linked_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("org_id", "assessment")
);
