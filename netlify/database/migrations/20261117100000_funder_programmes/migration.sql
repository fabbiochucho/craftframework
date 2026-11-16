-- A funding partner's own grants, report types and funding streams, entered by its staff, so the organisations it
-- funds can choose them in Finance Triangulation.
CREATE TABLE IF NOT EXISTS "funder_programmes" (
  "firm_id" text PRIMARY KEY,
  "grants" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "report_types" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "streams" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_by" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
