-- Exclusion, debarment and sanctions screening results (src/lib/screening.ts). Possible matches are reviewed by a
-- person (confirmed match or false positive); nothing is decided automatically. Additive: one new table.
CREATE TABLE IF NOT EXISTS "screenings" (
  "id" text PRIMARY KEY,
  "org_id" text NOT NULL,
  "award_id" text,
  "subject_name" text NOT NULL,
  "subject_type" text NOT NULL CHECK ("subject_type" IN ('organisation', 'person')),
  "country" text NOT NULL DEFAULT '',
  "provider" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IN ('clear', 'possible_match', 'error', 'not_configured')),
  "matches" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "checked_by" text NOT NULL,
  "checked_at" timestamp with time zone NOT NULL DEFAULT now(),
  "review" text NOT NULL DEFAULT '' CHECK ("review" IN ('', 'confirmed_match', 'false_positive')),
  "review_note" text NOT NULL DEFAULT '',
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "screenings_org_idx" ON "screenings" ("org_id");
