-- Evidence requests inside an engagement (reviewer asks, organisation links registry items and submits,
-- reviewer accepts or asks for more; overdue reminders). Additive: two new tables.
CREATE TABLE IF NOT EXISTS "evidence_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "engagement_id" text NOT NULL REFERENCES "validation_engagements"("id") ON DELETE CASCADE,
  "org_id" text NOT NULL,
  "title" text NOT NULL,
  "indicator_id" text,
  "note" text DEFAULT '' NOT NULL,
  "due_on" date NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "requested_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "submitted_by" text,
  "submitted_at" timestamp with time zone,
  "submission_note" text DEFAULT '' NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "review_note" text DEFAULT '' NOT NULL,
  "reminded_at" timestamp with time zone,
  "reminder_count" integer DEFAULT 0 NOT NULL
);
CREATE INDEX IF NOT EXISTS "evidence_requests_engagement_idx" ON "evidence_requests" ("engagement_id");
CREATE INDEX IF NOT EXISTS "evidence_requests_org_status_idx" ON "evidence_requests" ("org_id", "status");
CREATE TABLE IF NOT EXISTS "evidence_request_items" (
  "id" text PRIMARY KEY NOT NULL,
  "request_id" text NOT NULL REFERENCES "evidence_requests"("id") ON DELETE CASCADE,
  "evidence_id" integer NOT NULL REFERENCES "evidence_registry"("id") ON DELETE CASCADE,
  "document_name" text NOT NULL,
  "sha256" text,
  "linked_by" text NOT NULL,
  "linked_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evidence_request_items_uq" UNIQUE ("request_id", "evidence_id")
);
CREATE INDEX IF NOT EXISTS "evidence_request_items_request_idx" ON "evidence_request_items" ("request_id");
