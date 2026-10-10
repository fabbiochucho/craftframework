CREATE TABLE "action_items" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"cap_id" integer NOT NULL,
	"sequence_num" integer DEFAULT 1 NOT NULL,
	"action_description" text NOT NULL,
	"owner" text,
	"target_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"evidence_uploaded_at" timestamp with time zone,
	"verified_by" text,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "action_logs" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"action_id" integer NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL,
	"event" text NOT NULL,
	"old_value" text,
	"new_value" text
);
--> statement-breakpoint
CREATE TABLE "cap_records" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_id" integer,
	"finding_description" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"corrective_action" text DEFAULT '' NOT NULL,
	"assigned_to" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"completion_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_approvals" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"evidence_id" integer NOT NULL,
	"reviewer_id" text NOT NULL,
	"review_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"comments" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esg_frameworks" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"framework_name" text NOT NULL,
	"jurisdiction" text DEFAULT 'global' NOT NULL,
	"applicability" text DEFAULT 'all' NOT NULL,
	"adoption_status" text DEFAULT 'available' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esg_implementation_plans" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"requirement_id" integer NOT NULL,
	"owner" text,
	"status" text DEFAULT 'not_started' NOT NULL,
	"timeline_start" date,
	"timeline_end" date,
	"milestone_1" text,
	"milestone_2" text,
	"milestone_3" text,
	"evidence_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esg_milestones" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"milestone_num" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"target_date" date,
	"status" text DEFAULT 'not_started' NOT NULL,
	"completion_evidence_link" text
);
--> statement-breakpoint
CREATE TABLE "esg_requirements" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"framework_id" integer NOT NULL,
	"requirement_id" text NOT NULL,
	"requirement_text" text NOT NULL,
	"category" text DEFAULT 'governance' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"implementation_deadline" date
);
--> statement-breakpoint
CREATE TABLE "evidence_links" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"evidence_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"link_type" text DEFAULT 'supports' NOT NULL,
	"reviewer_notes" text DEFAULT '' NOT NULL,
	"approved_by" text,
	"approval_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "evidence_registry" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"document_name" text NOT NULL,
	"document_type" text DEFAULT 'evidence' NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_path" text NOT NULL,
	"file_size_kb" integer DEFAULT 0 NOT NULL,
	"mime_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"expiry_date" date,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "governance_assessments" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"assessment_type" text DEFAULT 'G2G' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"findings_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_findings" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"assessment_id" integer NOT NULL,
	"domain" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"recommendation" text DEFAULT '' NOT NULL,
	"evidence_link" text,
	"owner_assignment" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_scores" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"assessment_id" integer NOT NULL,
	"pillar" text NOT NULL,
	"domain" text NOT NULL,
	"tier_level" integer DEFAULT 1 NOT NULL,
	"evidence_uploaded" boolean DEFAULT false NOT NULL,
	"reviewer_notes" text DEFAULT '' NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "governance_scores_uq" UNIQUE("assessment_id","pillar","domain")
);
--> statement-breakpoint
CREATE TABLE "report_versions" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"report_id" integer NOT NULL,
	"version_num" integer DEFAULT 1 NOT NULL,
	"pdf_url" text,
	"json_export_url" text,
	"email_sent_to" text,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"report_type" text NOT NULL,
	"generated_by" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_as_of_date" date NOT NULL,
	"status_snapshot" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_issue_responses" (
	"id" serial PRIMARY KEY,
	"issue_id" integer NOT NULL,
	"responder" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_issues" (
	"id" serial PRIMARY KEY,
	"org_id" integer,
	"workspace_id" integer,
	"category" text DEFAULT 'question' NOT NULL,
	"description" text NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"github_issue_url" text,
	"cap_id" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ws_audit_log" (
	"id" serial PRIMARY KEY,
	"org_id" integer NOT NULL,
	"workspace_id" integer,
	"actor_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"action" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"details" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ws_org_members" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"org_id" integer NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"permissions" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ws_org_members_user_org_uq" UNIQUE("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "ws_organizations" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"type" text DEFAULT 'private' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "action_items_cap_idx" ON "action_items" ("org_id","cap_id");--> statement-breakpoint
CREATE INDEX "action_logs_action_idx" ON "action_logs" ("org_id","action_id");--> statement-breakpoint
CREATE INDEX "cap_records_ws_idx" ON "cap_records" ("org_id","workspace_id");--> statement-breakpoint
CREATE INDEX "document_approvals_evidence_idx" ON "document_approvals" ("org_id","evidence_id");--> statement-breakpoint
CREATE INDEX "esg_frameworks_ws_idx" ON "esg_frameworks" ("org_id","workspace_id");--> statement-breakpoint
CREATE INDEX "esg_plans_ws_idx" ON "esg_implementation_plans" ("org_id","workspace_id");--> statement-breakpoint
CREATE INDEX "esg_milestones_plan_idx" ON "esg_milestones" ("org_id","plan_id");--> statement-breakpoint
CREATE INDEX "esg_requirements_framework_idx" ON "esg_requirements" ("org_id","framework_id");--> statement-breakpoint
CREATE INDEX "evidence_links_evidence_idx" ON "evidence_links" ("org_id","evidence_id");--> statement-breakpoint
CREATE INDEX "evidence_links_target_idx" ON "evidence_links" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "evidence_registry_ws_idx" ON "evidence_registry" ("org_id","workspace_id");--> statement-breakpoint
CREATE INDEX "governance_assessments_ws_idx" ON "governance_assessments" ("org_id","workspace_id");--> statement-breakpoint
CREATE INDEX "governance_findings_assessment_idx" ON "governance_findings" ("org_id","assessment_id");--> statement-breakpoint
CREATE INDEX "report_versions_report_idx" ON "report_versions" ("org_id","report_id");--> statement-breakpoint
CREATE INDEX "reports_ws_idx" ON "reports" ("org_id","workspace_id");--> statement-breakpoint
CREATE INDEX "support_issue_responses_issue_idx" ON "support_issue_responses" ("issue_id");--> statement-breakpoint
CREATE INDEX "workspaces_org_idx" ON "workspaces" ("org_id");--> statement-breakpoint
CREATE INDEX "ws_audit_log_org_idx" ON "ws_audit_log" ("org_id","workspace_id");--> statement-breakpoint
CREATE INDEX "ws_org_members_org_idx" ON "ws_org_members" ("org_id");