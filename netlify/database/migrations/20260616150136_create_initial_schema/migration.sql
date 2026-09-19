CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY,
	"org_id" text NOT NULL,
	"version" text DEFAULT 'v3.0' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"active_lenses" jsonb DEFAULT '[]' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY,
	"org_id" text,
	"actor" text DEFAULT 'system' NOT NULL,
	"action" text NOT NULL,
	"target" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'Config' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "capacity_actions" (
	"id" serial PRIMARY KEY,
	"org_id" text NOT NULL,
	"risk_id" text NOT NULL,
	"question_id" text,
	"domain" text,
	"gap_description" text,
	"capacity_action" text,
	"owner" text,
	"due_date" text,
	"status" text DEFAULT 'To-be-Initiated' NOT NULL,
	"evidence_link" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "capacity_actions_org_risk_unique" UNIQUE("org_id","risk_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_items" (
	"id" text PRIMARY KEY,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"stream" text DEFAULT 'reporting' NOT NULL,
	"type" text DEFAULT 'donor_financial' NOT NULL,
	"donor_or_authority" text DEFAULT '' NOT NULL,
	"frequency" text DEFAULT 'annual' NOT NULL,
	"next_due_date" text NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"sector" text DEFAULT '' NOT NULL,
	"owner" text DEFAULT 'Unassigned' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"target_donor" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"reviewer" text,
	"created_by" text,
	"archetype" text,
	"sector" text,
	"subsector" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_updated" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY,
	"domain" text NOT NULL,
	"tier" integer NOT NULL,
	"tier_name" text DEFAULT '' NOT NULL,
	"question" text NOT NULL,
	"insight" text DEFAULT '' NOT NULL,
	"evidence" jsonb DEFAULT '[]' NOT NULL,
	"verification_method" text DEFAULT '' NOT NULL,
	"max_score" integer DEFAULT 5 NOT NULL,
	"risk_if_weak" text DEFAULT 'Moderate' NOT NULL,
	"capacity_action" text DEFAULT '' NOT NULL,
	"donor_link" text DEFAULT '' NOT NULL,
	"national_link" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'Moderate' NOT NULL,
	"risk_category" text,
	"lens" text,
	"archetypes" jsonb DEFAULT '[]' NOT NULL,
	"scoring_guide" text,
	"required_data_room_doc" text
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" serial PRIMARY KEY,
	"org_id" text NOT NULL,
	"question_id" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"assessor_score" integer,
	"negotiated_score" integer,
	"evidence_url" text,
	"evidence_name" text,
	"notes" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "responses_org_question_unique" UNIQUE("org_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL CONSTRAINT "users_email_unique" UNIQUE,
	"name" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"org_id" text,
	"role" text DEFAULT 'assessor' NOT NULL,
	"scope_id" text,
	"scope_label" text DEFAULT '' NOT NULL,
	"portfolio_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "audit_logs_org_idx" ON "audit_logs" ("org_id");--> statement-breakpoint
CREATE INDEX "capacity_actions_org_idx" ON "capacity_actions" ("org_id");--> statement-breakpoint
CREATE INDEX "compliance_items_org_idx" ON "compliance_items" ("org_id");--> statement-breakpoint
CREATE INDEX "questions_domain_idx" ON "questions" ("domain");--> statement-breakpoint
CREATE INDEX "questions_tier_idx" ON "questions" ("tier");--> statement-breakpoint
CREATE INDEX "responses_org_idx" ON "responses" ("org_id");--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_org_id_organizations_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE;