CREATE TABLE "action_templates" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "kind" text NOT NULL,
  "domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "archetypes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "body" text NOT NULL,
  "source" text NOT NULL,
  "licence" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "approved_by" text,
  "approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "copilot_requests" (
  "id" serial PRIMARY KEY,
  "org_id" text NOT NULL,
  "asked_by" text NOT NULL,
  "module" text NOT NULL,
  "domain_id" text NOT NULL,
  "domain_name" text NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "status" text NOT NULL,
  "template_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "draft" text DEFAULT '' NOT NULL,
  "answer" text DEFAULT '' NOT NULL,
  "answered_by" text,
  "answered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "copilot_requests_org_idx" ON "copilot_requests" ("org_id", "id");
--> statement-breakpoint
CREATE INDEX "copilot_requests_status_idx" ON "copilot_requests" ("status");
