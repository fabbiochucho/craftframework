-- Long-lived counters (hourly budgets, per-invitation caps) record when they expire, so the per-minute
-- limiter's cleanup no longer deletes them. Rows without expires_at keep the old 2-minute rule. Additive only.
ALTER TABLE "rate_limits" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
