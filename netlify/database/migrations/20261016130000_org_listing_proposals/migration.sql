-- Validator system: organisation listing proposals. An outside consultant with
-- an active access grant may PROPOSE a directory listing (draft summary); it goes
-- live only when the organisation's own staff approve it. Additive only: one new
-- table, nothing existing is altered.
CREATE TABLE IF NOT EXISTS "org_listing_proposals" (
	"id" text PRIMARY KEY,
	"org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"proposed_by" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
		CHECK ("status" IN ('pending', 'approved', 'rejected', 'withdrawn')),
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "org_listing_proposals_org_idx" ON "org_listing_proposals" ("org_id");
CREATE INDEX IF NOT EXISTS "org_listing_proposals_proposer_idx" ON "org_listing_proposals" ("proposed_by");
-- One pending proposal per organisation at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "org_listing_proposals_one_pending" ON "org_listing_proposals" ("org_id") WHERE "status" = 'pending';
