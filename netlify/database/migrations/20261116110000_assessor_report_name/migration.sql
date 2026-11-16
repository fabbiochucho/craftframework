-- Independent assessor grants: the assessor's name as it prints on this organisation's reports,
-- when it should differ from the name on their account.
ALTER TABLE "access_grants" ADD COLUMN IF NOT EXISTS "report_name" text;
