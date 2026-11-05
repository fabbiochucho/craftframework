-- Evidence-gated level statements for core bank questions (levels 1-5). Null keeps slider scoring.
-- Rules in src/lib/evidenceGate.ts. Additive: one nullable column.
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "levels" jsonb;
