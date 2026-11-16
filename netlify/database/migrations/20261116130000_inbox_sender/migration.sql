-- Inbox messages written by another person (not a system notification) carry who sent them.
ALTER TABLE "inbox_messages" ADD COLUMN IF NOT EXISTS "sender" text;
CREATE INDEX IF NOT EXISTS "inbox_messages_sender_idx" ON "inbox_messages" ("sender", "created_at");
