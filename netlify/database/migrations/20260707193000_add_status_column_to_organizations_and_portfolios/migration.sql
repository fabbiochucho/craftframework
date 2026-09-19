-- Soft-archive support for institutions and portfolios. A Super Admin (and, for
-- their own book, a Portfolio Reviewer) can archive an entity instead of hard
-- deleting it: the record and its data are retained but hidden from the working
-- surfaces, and can be restored. 'active' | 'archived'.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
