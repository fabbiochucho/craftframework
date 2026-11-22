CREATE TABLE "assessment_revisions" (
  "id" serial PRIMARY KEY,
  "source" text NOT NULL,
  "org_id" text NOT NULL,
  "assessment_id" text NOT NULL,
  "record_key" text NOT NULL,
  "period" text,
  "actor" text NOT NULL,
  "saved_at" timestamp with time zone DEFAULT now() NOT NULL,
  "snapshot" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assessment_revisions_actor_idx" ON "assessment_revisions" ("actor", "id");
--> statement-breakpoint
CREATE INDEX "assessment_revisions_scope_idx" ON "assessment_revisions" ("source", "assessment_id");
--> statement-breakpoint
ALTER TABLE "validation_funder_consents" ADD COLUMN "share_comments" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "validation_funder_consents" ADD COLUMN "funder_note" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "validation_funder_consents" ADD COLUMN "note_updated_by" text;
--> statement-breakpoint
ALTER TABLE "validation_funder_consents" ADD COLUMN "note_updated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "governance_scores" ADD COLUMN "updated_at" timestamp with time zone;
