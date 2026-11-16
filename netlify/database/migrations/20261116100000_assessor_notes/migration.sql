-- The independent assessor's reason for a score, and when they assessed it. Kept apart from `notes`
-- (the debrief consensus note) so neither overwrites the other.
ALTER TABLE "responses" ADD COLUMN IF NOT EXISTS "assessor_note" text;
ALTER TABLE "responses" ADD COLUMN IF NOT EXISTS "assessor_at" timestamptz;
