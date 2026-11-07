-- Super Admin support mode: evidence the CRAFT team added on an organisation's behalf is labelled.
ALTER TABLE "evidence_registry" ADD COLUMN IF NOT EXISTS "added_by_support" boolean DEFAULT false NOT NULL;
