-- Funder invitations: the funding-partner firm (firms.kind = 'funding_partner') the invitee joins on acceptance.
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "firm_id" text;
