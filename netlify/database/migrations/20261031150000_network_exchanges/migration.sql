-- Exchange log for networks (networks plan step 5). Additive: one new table.
-- Peer learning, exchange visits, study tours, conferences, mentoring, twinning, communities of practice and joint
-- trainings, recorded by coordinators against the assessment areas they address and the member organisations taking part.
CREATE TABLE IF NOT EXISTS "network_exchanges" (
	"id" text PRIMARY KEY,
	"network_id" text NOT NULL REFERENCES "networks"("id") ON DELETE CASCADE,
	"node_id" text NOT NULL REFERENCES "network_nodes"("id") ON DELETE CASCADE,
	"type" text NOT NULL CHECK ("type" IN ('peer-learning', 'exchange-visit', 'study-tour', 'conference', 'mentoring', 'twinning', 'community-of-practice', 'joint-training')),
	"title" text NOT NULL,
	"held_on" date NOT NULL,
	"location" text NOT NULL DEFAULT '',
	"instrument" text NOT NULL,
	"areas" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"org_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"people" integer NOT NULL DEFAULT 0 CHECK ("people" >= 0),
	"follow_up" text NOT NULL DEFAULT '',
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "network_exchanges_network_idx" ON "network_exchanges" ("network_id");
