-- Validator system review follow-ups: the organisation's evidence linked to ladder indicators.
-- New table only. Evidence stays in the existing registry / Blobs store; a link is a reference, never a copy.
CREATE TABLE IF NOT EXISTS "validation_evidence_links" (
	"id" text PRIMARY KEY,
	"engagement_id" text NOT NULL REFERENCES "validation_engagements"("id") ON DELETE CASCADE,
	"indicator_id" text NOT NULL,
	"evidence_id" integer NOT NULL REFERENCES "evidence_registry"("id") ON DELETE CASCADE,
	-- Name and type as linked, so the reference stays meaningful in the frozen snapshot.
	"document_name" text NOT NULL,
	"document_type" text DEFAULT 'evidence' NOT NULL,
	-- Hash of the stored file when it could be read at link time (never the contents).
	"sha256" text,
	"linked_by" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_evidence_links_uq" UNIQUE ("engagement_id", "indicator_id", "evidence_id")
);
CREATE INDEX IF NOT EXISTS "validation_evidence_links_engagement_idx" ON "validation_evidence_links" ("engagement_id");
