-- NPHI, JEE and SPAR assessments (Org Workspaces) joined to the main CRAFT organisation, so the institute's
-- dashboard, progress steps, independent assessor and grant links reach them (netlify/lib/nphi.ts).
ALTER TABLE "ws_organizations" ADD COLUMN IF NOT EXISTS "craft_org_id" text;
CREATE INDEX IF NOT EXISTS "ws_organizations_craft_org_idx" ON "ws_organizations" ("craft_org_id");

-- The independent assessor's own level for each item, beside the institute's (governance_scores).
CREATE TABLE IF NOT EXISTS "catalogue_independent_scores" (
  "assessment_id" integer NOT NULL,
  "domain" text NOT NULL,
  "score" integer,
  "not_applicable" boolean NOT NULL DEFAULT false,
  "note" text NOT NULL DEFAULT '',
  "assessor" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("assessment_id", "domain")
);

-- The assessor's declaration of independence, required before they score.
CREATE TABLE IF NOT EXISTS "catalogue_independence" (
  "assessment_id" integer NOT NULL,
  "assessor" text NOT NULL,
  "organisation" text NOT NULL DEFAULT '',
  "declared_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("assessment_id", "assessor")
);
