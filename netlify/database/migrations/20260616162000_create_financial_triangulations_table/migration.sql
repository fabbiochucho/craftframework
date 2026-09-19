CREATE TABLE IF NOT EXISTS "financial_triangulations" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "context_key" text NOT NULL,
  "donor_id" text NOT NULL,
  "grant_id" text NOT NULL,
  "report_type_id" text NOT NULL,
  "stream_id" text NOT NULL,
  "period_id" text NOT NULL,
  "opening_balance" integer DEFAULT 0 NOT NULL,
  "income_received" integer DEFAULT 0 NOT NULL,
  "expenditures" integer DEFAULT 0 NOT NULL,
  "adjustments" integer DEFAULT 0 NOT NULL,
  "actual_bank_balance" integer DEFAULT 0 NOT NULL,
  "finance_officer_notes" text DEFAULT '' NOT NULL,
  "grant_manager_commentary" text DEFAULT '' NOT NULL,
  "assessor_notes" text DEFAULT '' NOT NULL,
  "verification_status" text DEFAULT 'verified' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "locked_by" text,
  "locked_at" text,
  "history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "financial_triangulations_org_context_unique" ON "financial_triangulations" USING btree ("org_id","context_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_triangulations_org_idx" ON "financial_triangulations" USING btree ("org_id");
