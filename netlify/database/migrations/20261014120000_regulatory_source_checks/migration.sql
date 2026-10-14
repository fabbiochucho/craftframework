-- Re-verification log for regulatory sources (jurisdiction packs and 54-country profiles).
CREATE TABLE IF NOT EXISTS "regulatory_source_checks" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"source_key" text NOT NULL,
	"outcome" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"checked_by" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "regulatory_source_checks_ws_idx" ON "regulatory_source_checks" ("org_id", "workspace_id", "source_key");
