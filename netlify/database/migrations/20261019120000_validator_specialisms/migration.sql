-- Specialist accreditation (CRAFT indices spec §7). Additive: one new table and one column with a default.
-- A specialism is granted only by passing its specialist assessment (/api/training) and counts only while the
-- validator's main accreditation is current, so it renews and lapses with it.
CREATE TABLE IF NOT EXISTS "validator_specialisms" (
	"email" text NOT NULL,
	"specialism" text NOT NULL CHECK ("specialism" IN ('fiduciary', 'safeguards')),
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" text NOT NULL,
	"attempt_id" text,
	PRIMARY KEY ("email", "specialism")
);
-- Which assessment an attempt is: the knowledge exam or a specialist assessment.
ALTER TABLE "training_exam_attempts" ADD COLUMN IF NOT EXISTS "assessment" text DEFAULT 'knowledge' NOT NULL
	CHECK ("assessment" IN ('knowledge', 'fiduciary', 'safeguards'));
