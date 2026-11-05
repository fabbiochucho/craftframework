-- Milestone register and verification pack per award (src/lib/milestones.ts).
CREATE TABLE IF NOT EXISTS "award_milestones" (
  "id" text PRIMARY KEY NOT NULL,
  "award_id" text NOT NULL,
  "org_id" text NOT NULL,
  "title" text NOT NULL,
  "owner" text DEFAULT '' NOT NULL,
  "indicator" text DEFAULT '' NOT NULL,
  "baseline" text DEFAULT '' NOT NULL,
  "target" text DEFAULT '' NOT NULL,
  "verification_means" text DEFAULT '' NOT NULL,
  "due_date" date,
  "status" text DEFAULT 'planned' NOT NULL,
  "approved_by" text,
  "funder_note" text DEFAULT '' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "award_milestones_award_idx" ON "award_milestones" ("award_id");
CREATE TABLE IF NOT EXISTS "milestone_evidence" (
  "id" text PRIMARY KEY NOT NULL,
  "milestone_id" text NOT NULL,
  "org_id" text NOT NULL,
  "description" text NOT NULL,
  "ref" text NOT NULL,
  "added_by" text NOT NULL,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "milestone_evidence_milestone_idx" ON "milestone_evidence" ("milestone_id");
