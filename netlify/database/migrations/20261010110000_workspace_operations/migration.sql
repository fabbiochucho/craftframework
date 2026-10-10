CREATE TABLE "report_schedules" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"report_type" text NOT NULL,
	"cadence" text NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"format" text DEFAULT 'pdf' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"schedule_day" integer DEFAULT 1 NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gdpr_requests" (
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
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_pk" PRIMARY KEY("key", "window_start")
);
--> statement-breakpoint
CREATE INDEX "report_schedules_due_idx" ON "report_schedules" ("paused", "next_run_at");
--> statement-breakpoint
CREATE INDEX "report_schedules_workspace_idx" ON "report_schedules" ("org_id", "workspace_id");
--> statement-breakpoint
CREATE INDEX "gdpr_requests_org_idx" ON "gdpr_requests" ("org_id", "status");
--> statement-breakpoint
ALTER TABLE "governance_findings" ADD COLUMN "sensitive" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "ws_org_members" ADD COLUMN "user_id_hash" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "ws_org_members_user_hash_org_uq" ON "ws_org_members" ("user_id_hash", "org_id");
