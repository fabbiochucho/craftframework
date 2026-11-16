-- The people an organisation names for its finance workflow (Finance Triangulation): one finance officer and one
-- grant manager each, on top of their normal access.
CREATE TABLE IF NOT EXISTS "finance_roles" (
  "org_id" text NOT NULL,
  "role" text NOT NULL,
  "email" text NOT NULL,
  "assigned_by" text NOT NULL,
  "assigned_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("org_id", "role")
);
