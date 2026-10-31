-- Self-serve networks. Additive: three columns on networks.
-- Any signed-in organisation, funder or coordinator can create a network (the creator becomes its top-level coordinator);
-- the Super Admin can mark known networks as verified and archive misused ones. kind = 'network' or a funder 'cohort'.
-- secretariat_org_id = the organisation that runs the network (its Network Capacity Index results feed the network profile).
ALTER TABLE "networks" ADD COLUMN IF NOT EXISTS "verified" boolean NOT NULL DEFAULT false;
ALTER TABLE "networks" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'network' CHECK ("kind" IN ('network', 'cohort'));
ALTER TABLE "networks" ADD COLUMN IF NOT EXISTS "secretariat_org_id" text;
