-- Member value survey for network rounds (networks plan step 4). Additive: one new table.
-- Which network services a member used in the period and how useful each was (1-5), plus would-recommend (0-10).
-- Only reported in aggregate, and never for groups under 5 members.
CREATE TABLE IF NOT EXISTS "network_value_responses" (
	"round_id" text NOT NULL REFERENCES "network_rounds"("id") ON DELETE CASCADE,
	"org_id" text NOT NULL,
	"answers" jsonb NOT NULL,
	"answered_by" text NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("round_id", "org_id")
);
