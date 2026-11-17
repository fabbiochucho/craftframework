-- What kind of support an award gives (technical assistance, project grant, core funding, ...), separate from how it is paid.
-- Funders' grants carry the same list inside funder_programmes.grants (a "types" array on each grant).
ALTER TABLE "awards" ADD COLUMN IF NOT EXISTS "support_types" jsonb NOT NULL DEFAULT '[]'::jsonb;
