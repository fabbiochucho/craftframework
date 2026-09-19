ALTER TABLE "access_grants" ADD COLUMN IF NOT EXISTS "role" text;--> statement-breakpoint
ALTER TABLE "access_grants" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "section11_disclosures" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"folder_key" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "section11_org_folder_unique" UNIQUE("org_id","folder_key")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section11_org_idx" ON "section11_disclosures" ("org_id");
