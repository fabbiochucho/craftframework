CREATE TABLE "support_escalations" (
  "id" serial PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "message" text NOT NULL,
  "contact_email" text NOT NULL,
  "category" text NOT NULL,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
