CREATE TABLE "section11_disclosures" (
	"id" text PRIMARY KEY,
	"org_id" text NOT NULL,
	"folder_key" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "section11_org_folder_unique" UNIQUE("org_id","folder_key")
);
--> statement-breakpoint
ALTER TABLE "access_grants" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "access_grants" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "section11_org_idx" ON "section11_disclosures" ("org_id");