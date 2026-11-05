-- Universal institutional assessment questions: who to interview, and the funding models a question applies to
-- (empty = every organisation). Additive: two nullable/defaulted columns on questions.
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "interviewee" text;
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "modalities" jsonb NOT NULL DEFAULT '[]'::jsonb;
