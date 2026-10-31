-- Network assessment rounds (networks plan step 2). Additive: three new tables.
-- A round assesses every accepted member under one level with one instrument in a window. Members submit a frozen
-- snapshot of their scores; optional perspective scores (board, management, staff, community, facilitator) per domain.
CREATE TABLE IF NOT EXISTS "network_rounds" (
	"id" text PRIMARY KEY,
	"network_id" text NOT NULL REFERENCES "networks"("id") ON DELETE CASCADE,
	"node_id" text NOT NULL REFERENCES "network_nodes"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"instrument" text NOT NULL,
	"opens_on" date NOT NULL,
	"closes_on" date NOT NULL,
	"perspectives" boolean NOT NULL DEFAULT false,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"last_reminded_at" timestamp with time zone,
	CHECK ("opens_on" <= "closes_on")
);
CREATE INDEX IF NOT EXISTS "network_rounds_network_idx" ON "network_rounds" ("network_id");

CREATE TABLE IF NOT EXISTS "network_round_submissions" (
	"round_id" text NOT NULL REFERENCES "network_rounds"("id") ON DELETE CASCADE,
	"org_id" text NOT NULL,
	"scores" jsonb NOT NULL,
	"submitted_by" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("round_id", "org_id")
);

CREATE TABLE IF NOT EXISTS "network_round_perspectives" (
	"round_id" text NOT NULL REFERENCES "network_rounds"("id") ON DELETE CASCADE,
	"org_id" text NOT NULL,
	"perspective" text NOT NULL CHECK ("perspective" IN ('board', 'management', 'staff', 'community', 'facilitator')),
	"scores" jsonb NOT NULL,
	"entered_by" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("round_id", "org_id", "perspective")
);
