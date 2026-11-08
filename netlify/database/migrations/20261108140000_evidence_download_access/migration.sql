-- Per document linked to an evidence request: whether the reviewer may download the original or only view a
-- watermarked copy. The organisation sets it (and can change it); the reviewer can ask, with a reason.
-- Engagement requests keep downloading (as before); independent-assessor requests are view only.
ALTER TABLE "evidence_request_items" ADD COLUMN IF NOT EXISTS "download_access" text NOT NULL DEFAULT 'allowed';
ALTER TABLE "evidence_request_items" ADD COLUMN IF NOT EXISTS "download_requested_by" text;
ALTER TABLE "evidence_request_items" ADD COLUMN IF NOT EXISTS "download_requested_at" timestamptz;
ALTER TABLE "evidence_request_items" ADD COLUMN IF NOT EXISTS "download_reason" text NOT NULL DEFAULT '';
ALTER TABLE "evidence_request_items" ADD COLUMN IF NOT EXISTS "download_decided_by" text;
ALTER TABLE "evidence_request_items" ADD COLUMN IF NOT EXISTS "download_decided_at" timestamptz;
UPDATE "evidence_request_items" i SET "download_access" = 'view_only' FROM "evidence_requests" r WHERE r."id" = i."request_id" AND r."engagement_id" IS NULL;
-- New links default to view only (fail closed); the API always sets the organisation's choice.
ALTER TABLE "evidence_request_items" ALTER COLUMN "download_access" SET DEFAULT 'view_only';
