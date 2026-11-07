-- Invitations by email for organisations (portfolio, engagement, network) and platform-wide member invites.
-- Additive: new nullable columns plus `kind` defaulting to 'member' (existing rows keep their meaning).
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'member' NOT NULL;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "org_id" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "org_name" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "engagement" jsonb;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "network_node_id" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "accepted_org_id" text;
CREATE INDEX IF NOT EXISTS "invitations_network_node_idx" ON "invitations" ("network_node_id");
-- organization: the type the inviter chose in the invitation wizard (CRAFT archetype, sector, ISO country);
-- prefills the new organisation's profile on acceptance.
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "org_archetype" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "org_sector" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "org_country" text;
