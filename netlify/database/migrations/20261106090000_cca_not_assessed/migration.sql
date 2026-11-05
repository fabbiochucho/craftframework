-- Domains deliberately left out of a capacity assessment (domain id -> reason).
-- Left out of area and overall averages (src/lib/cca/engine.ts). Additive: one column with a default.
ALTER TABLE "cca_assessments" ADD COLUMN IF NOT EXISTS "not_assessed" jsonb NOT NULL DEFAULT '{}'::jsonb;
