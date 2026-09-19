CREATE TABLE "response_notes" (
	"id" serial PRIMARY KEY,
	"org_id" text NOT NULL,
	"question_id" text NOT NULL,
	"author_email" text DEFAULT '' NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"author_role" text DEFAULT 'assessor' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "response_notes_org_idx" ON "response_notes" ("org_id");--> statement-breakpoint
CREATE INDEX "response_notes_org_question_idx" ON "response_notes" ("org_id","question_id");