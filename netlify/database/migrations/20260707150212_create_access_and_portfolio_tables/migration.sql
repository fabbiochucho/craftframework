CREATE TABLE IF NOT EXISTS "access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"grantee" text NOT NULL,
	"granted_by" text,
	"firm_id" text,
	"level" text DEFAULT 'read' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"portfolio_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"responded_at" timestamp with time zone,
	CONSTRAINT "access_grants_org_grantee_unique" UNIQUE("org_id","grantee")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firm_members" (
	"firm_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'consultant' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "firm_members_firm_email_unique" UNIQUE("firm_id","email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"inviter" text,
	"inviter_name" text,
	"portfolio_id" text,
	"role" text DEFAULT 'assessor' NOT NULL,
	"scope_label" text DEFAULT '' NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"responded_at" timestamp with time zone,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portfolio_orgs" (
	"portfolio_id" text NOT NULL,
	"org_id" text NOT NULL,
	CONSTRAINT "portfolio_orgs_pf_org_unique" UNIQUE("portfolio_id","org_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portfolios" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"reviewer" text,
	"firm_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_updated" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_grants_org_idx" ON "access_grants" ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_grants_grantee_idx" ON "access_grants" ("grantee");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "firm_members_firm_idx" ON "firm_members" ("firm_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "firm_members_email_idx" ON "firm_members" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_email_idx" ON "invitations" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_inviter_idx" ON "invitations" ("inviter");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portfolio_orgs_pf_idx" ON "portfolio_orgs" ("portfolio_id");--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "firm_members" ADD CONSTRAINT "firm_members_firm_id_firms_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "portfolio_orgs" ADD CONSTRAINT "portfolio_orgs_portfolio_id_portfolios_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "portfolio_orgs" ADD CONSTRAINT "portfolio_orgs_org_id_organizations_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
