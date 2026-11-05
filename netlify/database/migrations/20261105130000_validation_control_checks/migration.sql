-- Validator review rigour: the seven control checks behind each validator score (design, authorisation, system
-- support, operating effectiveness, traceability, adequacy, sustainability) and a "not evidenced" result.
-- Additive: two defaulted columns on validation_scores. Rules in src/lib/controlChecks.ts.
ALTER TABLE "validation_scores" ADD COLUMN IF NOT EXISTS "checks" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "validation_scores" ADD COLUMN IF NOT EXISTS "result" text NOT NULL DEFAULT 'scored' CHECK ("result" IN ('scored', 'not_evidenced'));
