CREATE TABLE "telegram_links" (
  "chat_id" text PRIMARY KEY,
  "email" text NOT NULL,
  "linked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "state" jsonb
);
--> statement-breakpoint
CREATE INDEX "telegram_links_email_idx" ON "telegram_links" ("email");
--> statement-breakpoint
CREATE TABLE "telegram_link_codes" (
  "code_hash" text PRIMARY KEY,
  "email" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "copilot_requests" ADD COLUMN "telegram_chat_id" text;
