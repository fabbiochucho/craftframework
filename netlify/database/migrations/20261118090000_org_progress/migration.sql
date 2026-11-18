-- Which assessment steps an organisation has been told it finished, when it said its 5-tier wizard was complete,
-- and when it was congratulated on finishing everything (netlify/lib/progress.ts).
CREATE TABLE IF NOT EXISTS "org_progress" (
  "org_id" text PRIMARY KEY,
  "notified" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "wizard_done_at" timestamp with time zone,
  "congratulated_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
-- When the organisation itself answered a question. Existing rows keep counting as answered (unchanged
-- behaviour); from now on a row written only by an independent assessor is not an answer by the organisation.
ALTER TABLE "responses" ADD COLUMN IF NOT EXISTS "self_at" timestamp with time zone;
UPDATE "responses" SET "self_at" = COALESCE("updated_at", now()) WHERE "self_at" IS NULL;
