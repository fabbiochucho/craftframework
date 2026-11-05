-- Awards (grants and contracts), funder remedial measures, the organisation-level issue register and consented
-- sharing of the track record (spec 6a-6c). Rules in src/lib/awards.ts. Additive: four new tables.
CREATE TABLE IF NOT EXISTS "awards" (
  "id" text PRIMARY KEY,
  "org_id" text NOT NULL,
  "title" text NOT NULL,
  "funder_name" text NOT NULL DEFAULT '',
  "funder_email" text NOT NULL DEFAULT '',
  "agreement_ref" text NOT NULL DEFAULT '',
  "value" numeric,
  "currency" text NOT NULL DEFAULT '',
  "modality" text NOT NULL DEFAULT '',
  "start_date" date,
  "end_date" date,
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'closed', 'closed_with_open_matters')),
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "awards_org_idx" ON "awards" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "awards_funder_idx" ON "awards" (lower("funder_email"));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "award_measures" (
  "id" text PRIMARY KEY,
  "award_id" text NOT NULL REFERENCES "awards" ("id"),
  "kind" text NOT NULL CHECK ("kind" IN ('special_condition', 'reimbursement_only', 'enhanced_monitoring', 'withheld_disbursement', 'suspension')),
  "description" text NOT NULL,
  "lifted_when" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'lifted')),
  "imposed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "lifted_at" timestamp with time zone,
  "created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_issues" (
  "id" text PRIMARY KEY,
  "org_id" text NOT NULL,
  "award_id" text REFERENCES "awards" ("id"),
  "source" text NOT NULL CHECK ("source" IN ('pre_award_condition', 'during_award', 'audit', 'funder_visit', 'complaint', 'incident', 'post_close', 'other')),
  "type" text NOT NULL CHECK ("type" IN ('financial', 'procurement', 'programme', 'reporting', 'governance', 'safeguarding', 'compliance', 'other')),
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "verified" boolean NOT NULL DEFAULT false,
  "verified_by" text,
  "org_response" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'closed')),
  "due_date" date,
  "opened_at" timestamp with time zone NOT NULL DEFAULT now(),
  "closed_at" timestamp with time zone,
  "fix_held" boolean,
  "recurrence_of" text,
  "created_by" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_issues_org_idx" ON "org_issues" ("org_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_shares" (
  "org_id" text NOT NULL,
  "viewer_email" text NOT NULL,
  "level" text NOT NULL CHECK ("level" IN ('summary', 'full')),
  "granted_by" text NOT NULL,
  "granted_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("org_id", "viewer_email")
);
