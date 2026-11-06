-- Facilitated scoring, Approach II (group consensus): domain id -> { agreed, note }. src/lib/cca/engine.ts resolveConsensus.
ALTER TABLE "cca_assessments" ADD COLUMN IF NOT EXISTS "consensus" jsonb DEFAULT '{}'::jsonb NOT NULL;
