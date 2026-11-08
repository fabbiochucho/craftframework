-- Delivery of invitation emails, reported by Resend's webhook: the provider's message id and the
-- latest status ('sent' | 'delivered' | 'delayed' | 'bounced' | 'complained'). Opens are not tracked.
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "email_id" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "delivery_status" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "delivery_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "invitations_email_id_idx" ON "invitations" ("email_id");
