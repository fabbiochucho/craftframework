CREATE TABLE IF NOT EXISTS "gdpr_requests" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"requested_by" text NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governance_validations" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"assessment_id" integer NOT NULL,
	"validator_email" text NOT NULL,
	"validator_name" text NOT NULL,
	"validator_organisation" text DEFAULT '' NOT NULL,
	"independence_declared" boolean DEFAULT false NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"method" text NOT NULL,
	"outcome" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"scores" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offline_framework_receipts" (
	"org_id" integer,
	"workspace_id" integer,
	"user_id" text,
	"operation_id" text,
	"fingerprint" text NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offline_framework_receipts_pkey" PRIMARY KEY("org_id","workspace_id","user_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offline_frameworks" (
	"org_id" integer,
	"workspace_id" integer,
	"id" text,
	"version" integer NOT NULL,
	"deleted" integer DEFAULT 0 NOT NULL,
	"payload" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offline_frameworks_pkey" PRIMARY KEY("org_id","workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qa_check_instances" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"period_id" integer NOT NULL,
	"check_id" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"owner" text,
	"reviewer" text,
	"due_date" date,
	"notes" text DEFAULT '' NOT NULL,
	"blocker" text DEFAULT '' NOT NULL,
	"evidence_id" integer,
	"na_reason" text DEFAULT '' NOT NULL,
	"na_set_by" text,
	"na_approved_by" text,
	"na_approved_at" timestamp with time zone,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qa_check_instances_uq" UNIQUE("period_id","check_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qa_periods" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"label" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"profile" jsonb DEFAULT '{}' NOT NULL,
	"checklist_version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"prepared_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"snapshot" jsonb,
	"revision_of" integer,
	"revision_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text,
	"window_start" timestamp with time zone,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_pkey" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_schedules" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"report_type" text NOT NULL,
	"cadence" text NOT NULL,
	"recipients" jsonb DEFAULT '[]' NOT NULL,
	"format" text DEFAULT 'pdf' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"schedule_day" integer DEFAULT 1 NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_escalations" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"message" text NOT NULL,
	"contact_email" text NOT NULL,
	"category" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "root_cause" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "expected_outcome" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "resources" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "dependencies" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "residual_risk" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_due" date;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "effectiveness_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "reopened_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "esg_frameworks" ADD COLUMN IF NOT EXISTS "settings" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_registry" ADD COLUMN IF NOT EXISTS "declared_kind" text;--> statement-breakpoint
ALTER TABLE "evidence_registry" ADD COLUMN IF NOT EXISTS "content_check" jsonb;--> statement-breakpoint
ALTER TABLE "governance_assessments" ADD COLUMN IF NOT EXISTS "reporting_period" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "governance_assessments" ADD COLUMN IF NOT EXISTS "innovation_support" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "governance_findings" ADD COLUMN IF NOT EXISTS "sensitive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "governance_scores" ADD COLUMN IF NOT EXISTS "not_applicable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "governance_scores" ADD COLUMN IF NOT EXISTS "na_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ws_org_members" ADD COLUMN IF NOT EXISTS "user_id_hash" text;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_org_id_id_unique" UNIQUE("org_id","id"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ws_org_members" ADD CONSTRAINT "ws_org_members_user_hash_org_uq" UNIQUE("user_id_hash","org_id"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gdpr_requests_org_idx" ON "gdpr_requests" ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_validations_assessment_idx" ON "governance_validations" ("org_id","assessment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qa_check_instances_period_idx" ON "qa_check_instances" ("org_id","period_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qa_periods_ws_idx" ON "qa_periods" ("org_id","workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_schedules_due_idx" ON "report_schedules" ("paused","next_run_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_schedules_workspace_idx" ON "report_schedules" ("org_id","workspace_id");