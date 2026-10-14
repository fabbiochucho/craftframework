-- CAP upgrades: correction vs preventive action, duplicate merging with provenance, escalation.
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "immediate_correction" text DEFAULT '' NOT NULL;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "preventive_action" text DEFAULT '' NOT NULL;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "merged_into" integer;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "merged_from" jsonb DEFAULT '[]' NOT NULL;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "escalation_level" integer DEFAULT 0 NOT NULL;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "escalated_at" timestamp with time zone;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "escalated_to" text;
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "escalation_reason" text DEFAULT '' NOT NULL;
