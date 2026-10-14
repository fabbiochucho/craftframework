-- Organisational design & diagnosis reviews (CRAFT-OD 1.0).
CREATE TABLE IF NOT EXISTS "org_design_reviews" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"title" text NOT NULL,
	"methodology_version" text NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"prepared_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "org_design_reviews_ws_idx" ON "org_design_reviews" ("org_id", "workspace_id");
