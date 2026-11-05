-- Findings on corrective action plans: the full finding (criteria, condition, consequence; the cause is root_cause),
-- likelihood x impact before and after controls, an escalation category, and the management response.
-- Additive: defaulted or nullable columns on cap_records. Rules in src/lib/riskMatrix.ts.
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "criteria" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "condition" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "consequence" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "inherent_likelihood" integer CHECK ("inherent_likelihood" BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "inherent_impact" integer CHECK ("inherent_impact" BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "residual_likelihood" integer CHECK ("residual_likelihood" BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "residual_impact" integer CHECK ("residual_impact" BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "risk_category" text NOT NULL DEFAULT '' CHECK ("risk_category" IN ('', 'statutory', 'fiduciary', 'safeguarding', 'safety'));
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "management_response" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "cap_records" ADD COLUMN IF NOT EXISTS "response_stance" text NOT NULL DEFAULT '' CHECK ("response_stance" IN ('', 'agree', 'partly', 'disagree'));
