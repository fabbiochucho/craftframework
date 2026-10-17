-- Welcome email sent once when a person completes onboarding. Additive only.
ALTER TABLE "onboarding_progress" ADD COLUMN IF NOT EXISTS "welcome_email_sent_at" timestamp with time zone;
ALTER TABLE "onboarding_progress" ADD COLUMN IF NOT EXISTS "welcome_email_outcome" text;
