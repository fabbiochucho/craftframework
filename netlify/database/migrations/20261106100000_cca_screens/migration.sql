-- Quick pre-award screens (src/lib/cca/quickScreen.ts). One per organisation and award; outcome kept at completion.
CREATE TABLE IF NOT EXISTS "cca_screens" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "award_ref" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "score" integer,
  "max_score" integer,
  "outcome" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "cca_screens_one_per_award" UNIQUE("org_id", "award_ref")
);
CREATE INDEX IF NOT EXISTS "cca_screens_org_idx" ON "cca_screens" ("org_id");
