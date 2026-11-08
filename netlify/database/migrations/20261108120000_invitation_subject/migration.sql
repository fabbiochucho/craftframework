-- An optional subject line the inviter writes for an invitation email (null = the standard subject).
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "subject" text;
