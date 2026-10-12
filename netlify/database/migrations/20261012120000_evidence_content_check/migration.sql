-- Evidence content check: declared document kind and the result of reading the contents (no text stored).
ALTER TABLE "evidence_registry" ADD COLUMN IF NOT EXISTS "declared_kind" text;
ALTER TABLE "evidence_registry" ADD COLUMN IF NOT EXISTS "content_check" jsonb;
