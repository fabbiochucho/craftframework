-- Civil society networks (spec: craft-internal 2026-10-31-networks-and-nhocat). Additive: four new tables.
-- A network is a tree of levels (global → local); organisations join a level by accepting an invitation and choose
-- whether coordinators see their named results or only totals. Coordinators are added per level and see that level
-- and everything below it.
CREATE TABLE IF NOT EXISTS "networks" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text NOT NULL DEFAULT '',
	"status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'archived')),
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "network_nodes" (
	"id" text PRIMARY KEY,
	"network_id" text NOT NULL REFERENCES "networks"("id") ON DELETE CASCADE,
	"parent_id" text REFERENCES "network_nodes"("id") ON DELETE CASCADE,
	"level" text NOT NULL CHECK ("level" IN ('global', 'continental', 'subregional', 'national', 'subnational', 'local')),
	"name" text NOT NULL,
	"geo_code" text NOT NULL DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "network_nodes_network_idx" ON "network_nodes" ("network_id");

CREATE TABLE IF NOT EXISTS "network_members" (
	"id" text PRIMARY KEY,
	"node_id" text NOT NULL REFERENCES "network_nodes"("id") ON DELETE CASCADE,
	"org_id" text NOT NULL,
	"status" text NOT NULL DEFAULT 'invited' CHECK ("status" IN ('invited', 'accepted', 'declined', 'left')),
	"sharing" text NOT NULL DEFAULT 'aggregate' CHECK ("sharing" IN ('aggregate', 'full')),
	"invited_by" text NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "network_members_node_org_uq" ON "network_members" ("node_id", "org_id");
CREATE INDEX IF NOT EXISTS "network_members_org_idx" ON "network_members" ("org_id");

CREATE TABLE IF NOT EXISTS "network_admins" (
	"node_id" text NOT NULL REFERENCES "network_nodes"("id") ON DELETE CASCADE,
	"email" text NOT NULL,
	"role" text NOT NULL DEFAULT 'coordinator' CHECK ("role" IN ('coordinator', 'viewer')),
	"added_by" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("node_id", "email")
);
CREATE INDEX IF NOT EXISTS "network_admins_email_idx" ON "network_admins" ("email");
