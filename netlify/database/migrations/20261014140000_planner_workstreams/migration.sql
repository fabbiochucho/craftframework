-- Planner: workstreams, dependencies and budgets on implementation plans.
ALTER TABLE "esg_implementation_plans" ADD COLUMN IF NOT EXISTS "workstream" text DEFAULT '' NOT NULL;
ALTER TABLE "esg_implementation_plans" ADD COLUMN IF NOT EXISTS "depends_on" jsonb DEFAULT '[]' NOT NULL;
ALTER TABLE "esg_implementation_plans" ADD COLUMN IF NOT EXISTS "budget_estimate" numeric(14, 2);
ALTER TABLE "esg_implementation_plans" ADD COLUMN IF NOT EXISTS "budget_actual" numeric(14, 2);
ALTER TABLE "esg_implementation_plans" ADD COLUMN IF NOT EXISTS "budget_currency" text DEFAULT '' NOT NULL;
