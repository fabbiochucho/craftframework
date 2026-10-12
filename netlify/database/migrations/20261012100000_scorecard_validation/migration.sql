-- Independent (external) validation of approved CRAFT Governance Scorecard assessments.
CREATE TABLE IF NOT EXISTS "governance_validations" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL,
  "assessment_id" integer NOT NULL,
  "validator_email" text NOT NULL,
  "validator_name" text NOT NULL,
  "validator_organisation" text NOT NULL DEFAULT '',
  "independence_declared" boolean NOT NULL DEFAULT false,
  "scope" text NOT NULL DEFAULT '',
  "method" text NOT NULL,
  "outcome" text NOT NULL,
  "notes" text NOT NULL DEFAULT '',
  "scores" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "governance_validations_assessment_idx" ON "governance_validations" ("org_id", "assessment_id");
