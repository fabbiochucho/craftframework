-- Internal support tracker (Admin → Support): one inbox for the support chat, bot escalations and private reports,
-- the contact form and requests logged by hand. Subject, body, contact name and email are encrypted by the app
-- (rows copied from older tables below are encrypted by the daily encryption backfill). Additive: two new tables.
CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" serial PRIMARY KEY,
  "subject" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "source" text NOT NULL CHECK ("source" IN ('chat', 'escalation', 'private_report', 'contact_form', 'email', 'phone', 'whatsapp', 'meeting', 'other')),
  "source_ref" text NOT NULL DEFAULT '',
  "contact_name" text NOT NULL DEFAULT '',
  "contact_email" text NOT NULL DEFAULT '',
  "organisation" text NOT NULL DEFAULT '',
  "category" text NOT NULL DEFAULT 'question' CHECK ("category" IN ('question', 'bug', 'feature', 'account', 'data', 'complaint', 'other')),
  "priority" text NOT NULL DEFAULT 'normal' CHECK ("priority" IN ('low', 'normal', 'high', 'urgent')),
  "status" text NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'open', 'waiting', 'resolved', 'closed')),
  "due_at" timestamp with time zone,
  "created_by" text NOT NULL DEFAULT 'system',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_source_ref_uq" ON "support_tickets" ("source", "source_ref") WHERE "source_ref" <> '';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets" ("status", "updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_ticket_events" (
  "id" serial PRIMARY KEY,
  "ticket_id" integer NOT NULL REFERENCES "support_tickets" ("id"),
  "kind" text NOT NULL CHECK ("kind" IN ('created', 'note', 'reply', 'change')),
  "body" text NOT NULL DEFAULT '',
  "actor" text NOT NULL,
  "email_status" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_ticket_events_ticket_idx" ON "support_ticket_events" ("ticket_id", "id");
--> statement-breakpoint
-- Bring in what already arrived: support-chat issues and bot escalations / private reports.
INSERT INTO "support_tickets" ("subject", "body", "source", "source_ref", "contact_email", "category", "priority", "status", "created_at", "updated_at")
SELECT left("description", 90), "description", 'chat', 'issue:' || "id", "contact_email",
  CASE WHEN "category" IN ('question', 'bug', 'feature') THEN "category" ELSE 'other' END, 'normal',
  CASE "status" WHEN 'closed' THEN 'closed' WHEN 'responded' THEN 'waiting' ELSE 'open' END, "created_at", "created_at"
FROM "support_issues"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "support_tickets" ("subject", "body", "source", "source_ref", "contact_email", "category", "priority", "status", "created_at", "updated_at")
SELECT CASE WHEN "reason" = 'private_report' THEN 'Private report' ELSE 'Support escalation' END, "message",
  CASE WHEN "reason" = 'private_report' THEN 'private_report' ELSE 'escalation' END, 'escalation:' || "id", "contact_email",
  CASE WHEN "category" IN ('question', 'bug', 'feature') THEN "category" ELSE 'other' END,
  CASE WHEN "reason" = 'private_report' THEN 'high' ELSE 'normal' END, 'open', "created_at", "created_at"
FROM "support_escalations"
ON CONFLICT DO NOTHING;
