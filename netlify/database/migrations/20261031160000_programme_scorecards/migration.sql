-- Programme Response Scorecards (networks plan step 6). Additive: two new tables.
-- A scorecard asks every unit at one level of a network (e.g. each state) to self-assess its programme response with a
-- template (src/lib/programmeScorecard.ts); each unit's coordinators enter its scores.
-- Also adds the 'zonal' network level (a zone or region within a country, e.g. Nigeria's geopolitical zones).
ALTER TABLE "network_nodes" DROP CONSTRAINT IF EXISTS "network_nodes_level_check";
ALTER TABLE "network_nodes" ADD CONSTRAINT "network_nodes_level_check" CHECK ("level" IN ('global', 'continental', 'subregional', 'national', 'zonal', 'subnational', 'local'));
CREATE TABLE IF NOT EXISTS "programme_scorecards" (
	"id" text PRIMARY KEY,
	"network_id" text NOT NULL REFERENCES "networks"("id") ON DELETE CASCADE,
	"node_id" text NOT NULL REFERENCES "network_nodes"("id") ON DELETE CASCADE,
	"unit_level" text NOT NULL CHECK ("unit_level" IN ('global', 'continental', 'subregional', 'national', 'zonal', 'subnational', 'local')),
	"template" text NOT NULL,
	"name" text NOT NULL,
	"opens_on" date NOT NULL,
	"closes_on" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CHECK ("opens_on" <= "closes_on")
);
CREATE INDEX IF NOT EXISTS "programme_scorecards_network_idx" ON "programme_scorecards" ("network_id");

CREATE TABLE IF NOT EXISTS "programme_scorecard_entries" (
	"scorecard_id" text NOT NULL REFERENCES "programme_scorecards"("id") ON DELETE CASCADE,
	"node_id" text NOT NULL REFERENCES "network_nodes"("id") ON DELETE CASCADE,
	"scores" jsonb NOT NULL,
	"entered_by" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("scorecard_id", "node_id")
);
