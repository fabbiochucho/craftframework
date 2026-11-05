-- CRAFT Capacity Assessment (CCA): one assessment per organisation, module and year (and award, for the grant
-- lifecycle modules). Responses hold, per statement, whether it is met and the evidence seen. Scores are always
-- computed from the responses by src/lib/cca/engine.ts, never stored. Additive: one new table.
CREATE TABLE IF NOT EXISTS "cca_assessments" (
  "id" text PRIMARY KEY,
  "org_id" text NOT NULL,
  "module" text NOT NULL,
  "year" integer NOT NULL CHECK ("year" BETWEEN 2000 AND 2100),
  "award_ref" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'complete')),
  "assessor" text NOT NULL DEFAULT '',
  "org_lead" text NOT NULL DEFAULT '',
  "responses" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "votes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "swot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "plan" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone,
  CONSTRAINT "cca_assessments_one_per_year" UNIQUE ("org_id", "module", "year", "award_ref")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cca_assessments_org_idx" ON "cca_assessments" ("org_id");
