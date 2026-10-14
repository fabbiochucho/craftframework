-- Multi-factor sign-in (TOTP) and organisation MFA policy.
CREATE TABLE IF NOT EXISTS "user_mfa" (
	"user_key" text PRIMARY KEY,
	"secret" text,
	"pending_secret" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"enabled_at" timestamp with time zone,
	"last_step" integer DEFAULT -1 NOT NULL,
	"recovery_codes" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "ws_organizations" ADD COLUMN IF NOT EXISTS "require_mfa" boolean DEFAULT false NOT NULL;
