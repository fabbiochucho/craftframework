-- What kind of support an award gives (technical assistance, project grant, core funding, ...), separate from how it is paid.
-- Funders' grants carry the same list inside funder_programmes.grants (a "types" array on each grant).
ALTER TABLE "awards" ADD COLUMN IF NOT EXISTS "support_types" jsonb NOT NULL DEFAULT '[]'::jsonb;
-- A monetary value given for non-cash support (technical assistance, in-kind) is an estimate, not cash received.
ALTER TABLE "awards" ADD COLUMN IF NOT EXISTS "value_estimated" boolean NOT NULL DEFAULT false;
-- The amount a funder allocates to a beneficiary organisation (seen only by that organisation and the funder).
ALTER TABLE "grant_beneficiaries" ADD COLUMN IF NOT EXISTS "amount" numeric;
ALTER TABLE "grant_beneficiaries" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT '';
