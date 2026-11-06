-- Explanations for last year's improvement-plan targets that were not reached (domain id -> note). Completing a
-- reassessment requires one for every missed target (src/lib/cca/engine.ts unexplainedMisses).
ALTER TABLE "cca_assessments" ADD COLUMN IF NOT EXISTS "plan_review_notes" jsonb DEFAULT '{}'::jsonb NOT NULL;
