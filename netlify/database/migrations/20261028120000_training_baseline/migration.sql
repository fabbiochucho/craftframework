-- Pre- and post-tests for the explainer training videos: one row per attempt. Practice questions only; separate
-- from the certification exam and never counted towards accreditation.
-- Additive: a new table only. Nothing here changes an existing table or row.
CREATE TABLE IF NOT EXISTS "training_baseline_attempts" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"module_id" text NOT NULL,
	"kind" text NOT NULL CHECK ("kind" IN ('pre', 'post')),
	"score" integer NOT NULL CHECK ("score" >= 0),
	"total" integer NOT NULL CHECK ("total" > 0 AND "score" <= "total"),
	"answers" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "training_baseline_attempts_email_idx" ON "training_baseline_attempts" ("email");
CREATE INDEX IF NOT EXISTS "training_baseline_attempts_module_idx" ON "training_baseline_attempts" ("module_id");
-- The first pre-test is the baseline, so each learner takes it once per module (also safe against double submits).
CREATE UNIQUE INDEX IF NOT EXISTS "training_baseline_attempts_one_pre" ON "training_baseline_attempts" ("email", "module_id") WHERE "kind" = 'pre';
