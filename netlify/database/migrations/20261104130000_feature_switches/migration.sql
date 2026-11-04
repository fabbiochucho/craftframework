-- Feature switches (Admin → Features): a feature can be switched off (or back on) for everyone, an organisation type,
-- a country, a network, an organisation or one user. Rules are in src/lib/features.ts. Additive: one new table.
CREATE TABLE IF NOT EXISTS "feature_switches" (
  "id" serial PRIMARY KEY,
  "feature" text NOT NULL,
  "scope" text NOT NULL CHECK ("scope" IN ('global', 'archetype', 'country', 'network', 'org', 'user')),
  "scope_id" text NOT NULL DEFAULT '',
  "enabled" boolean NOT NULL,
  "reason" text NOT NULL,
  "set_by" text NOT NULL,
  "set_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone,
  CONSTRAINT "feature_switches_target_uq" UNIQUE ("feature", "scope", "scope_id")
);
