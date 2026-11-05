-- Desk review (evidence request list) and fieldwork log for the CRAFT Capacity Assessment.
-- Requirements come from src/lib/dataroom.ts; one row per organisation and document.
CREATE TABLE IF NOT EXISTS "desk_review_items" (
  "org_id" text NOT NULL,
  "requirement_id" text NOT NULL,
  "status" text DEFAULT 'missing' NOT NULL,
  "evidence_ref" text DEFAULT '' NOT NULL,
  "approved_on" date,
  "evidence_of_use" text DEFAULT '' NOT NULL,
  "not_available_reason" text DEFAULT '' NOT NULL,
  "custodian" text DEFAULT '' NOT NULL,
  "due_date" date,
  "assessor_note" text DEFAULT '' NOT NULL,
  "provided_by" text,
  "verified_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "desk_review_items_pk" PRIMARY KEY ("org_id", "requirement_id")
);
-- Interviews, walkthroughs, sample tests and site visits recorded during the review.
CREATE TABLE IF NOT EXISTS "fieldwork_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "kind" text NOT NULL,
  "held_on" date NOT NULL,
  "people" text DEFAULT '' NOT NULL,
  "requirement_id" text,
  "domain_ref" text,
  "summary" text NOT NULL,
  "result" text DEFAULT '' NOT NULL,
  "recorded_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "fieldwork_entries_org_idx" ON "fieldwork_entries" ("org_id");
