-- In-app inbox: a copy of each notification email, kept for its recipient to read on the platform.
CREATE TABLE IF NOT EXISTS "inbox_messages" (
  "id" serial PRIMARY KEY,
  "recipient" text NOT NULL,
  "kind" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "read_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "inbox_messages_recipient_idx" ON "inbox_messages" ("recipient", "created_at");
