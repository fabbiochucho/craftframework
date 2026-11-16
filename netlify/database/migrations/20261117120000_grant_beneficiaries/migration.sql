-- Organisations a funder names as beneficiaries of one of its grants, by the organisation's contact email.
-- The organisation is told and decides whether to add the grant to its awards.
CREATE TABLE IF NOT EXISTS "grant_beneficiaries" (
  "firm_id" text NOT NULL,
  "grant_id" text NOT NULL,
  "email" text NOT NULL,
  "added_by" text NOT NULL,
  "added_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("firm_id", "grant_id", "email")
);
CREATE INDEX IF NOT EXISTS "grant_beneficiaries_email_idx" ON "grant_beneficiaries" ("email");
