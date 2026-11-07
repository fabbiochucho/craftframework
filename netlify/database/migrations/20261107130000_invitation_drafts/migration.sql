-- Invitations held as drafts until someone sends them, sent on someone's behalf, and the access the
-- organisation gives the inviter on acceptance (e.g. 'independent_assessor'). Additive columns.
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "sent_by" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "created_by" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "grant_role" text;
-- Every invitation created before drafts existed was sent when it was created.
UPDATE "invitations" SET "sent_at" = "created_at" WHERE "sent_at" IS NULL;
