-- Laws register approvals (spec: laws register §8). Additive: one new table. A Super Admin approves a jurisdiction's
-- law entries after founder or counsel review; approved jurisdictions appear in organisations' jurisdiction reports.
CREATE TABLE IF NOT EXISTS "law_approvals" (
	"jurisdiction" text PRIMARY KEY CHECK ("jurisdiction" ~ '^[A-Z]{2}$'),
	"approved_by" text NOT NULL,
	"register_version" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL
);
