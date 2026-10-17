-- Invite emails keep the invitee's name. Additive: one nullable column.
-- (invitations.message already exists; the client now sends it.)
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "invitee_name" text;
