-- Network levels can be archived (and restored) instead of deleted, so past rounds and scorecards keep their history.
-- Archived levels take no new members, child levels, rounds or scorecard entries. Additive: one column.
ALTER TABLE "network_nodes" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'archived'));
