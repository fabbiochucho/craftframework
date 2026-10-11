-- ESG planner settings, Corrective Action & Evidence Hub fields, CRAFT scorecard N/A handling.
-- Additive only: every column has a default, so existing rows and older code keep working.
ALTER TABLE "esg_frameworks" ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "root_cause" text NOT NULL DEFAULT '';
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "expected_outcome" text NOT NULL DEFAULT '';
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "resources" text NOT NULL DEFAULT '';
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "dependencies" text NOT NULL DEFAULT '';
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "residual_risk" text NOT NULL DEFAULT '';
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_status" text NOT NULL DEFAULT 'not_required';
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_due" date;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_notes" text NOT NULL DEFAULT '';
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_reviewed_by" text;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_reviewed_at" timestamptz;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "reopened_count" integer NOT NULL DEFAULT 0;

ALTER TABLE "governance_scores" ADD COLUMN IF NOT EXISTS "not_applicable" boolean NOT NULL DEFAULT false;
ALTER TABLE "governance_scores" ADD COLUMN IF NOT EXISTS "na_reason" text NOT NULL DEFAULT '';

ALTER TABLE "governance_assessments" ADD COLUMN IF NOT EXISTS "reporting_period" text NOT NULL DEFAULT '';
ALTER TABLE "governance_assessments" ADD COLUMN IF NOT EXISTS "innovation_support" boolean NOT NULL DEFAULT false;

-- ESG Report Quality Checklist: reporting periods and per-period check instances.
CREATE TABLE IF NOT EXISTS "qa_periods" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL,
  "workspace_id" integer NOT NULL,
  "label" text NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "profile" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "checklist_version" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "prepared_by" text NOT NULL,
  "approved_by" text,
  "approved_at" timestamptz,
  "snapshot" jsonb,
  "revision_of" integer,
  "revision_reason" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY ("org_id", "workspace_id") REFERENCES "workspaces" ("org_id", "id")
);
CREATE INDEX IF NOT EXISTS "qa_periods_ws_idx" ON "qa_periods" ("org_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "qa_check_instances" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL,
  "period_id" integer NOT NULL REFERENCES "qa_periods" ("id"),
  "check_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'not_started',
  "owner" text,
  "reviewer" text,
  "due_date" date,
  "notes" text NOT NULL DEFAULT '',
  "blocker" text NOT NULL DEFAULT '',
  "evidence_id" integer,
  "na_reason" text NOT NULL DEFAULT '',
  "na_set_by" text,
  "na_approved_by" text,
  "na_approved_at" timestamptz,
  "updated_by" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "qa_check_instances_uq" UNIQUE ("period_id", "check_id")
);
CREATE INDEX IF NOT EXISTS "qa_check_instances_period_idx" ON "qa_check_instances" ("org_id", "period_id");
