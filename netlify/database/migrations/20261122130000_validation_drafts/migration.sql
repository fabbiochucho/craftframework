CREATE TABLE "governance_validation_drafts" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL,
  "assessment_id" integer NOT NULL,
  "validator_email" text NOT NULL,
  "payload" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "governance_validation_drafts_uq" UNIQUE ("assessment_id", "validator_email")
);
