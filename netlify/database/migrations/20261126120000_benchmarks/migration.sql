ALTER TABLE "organizations" ADD COLUMN "size_band" text;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "benchmark_opt_in_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "benchmark_opt_in_by" text;
--> statement-breakpoint
CREATE TABLE "benchmark_snapshots" (
  "id" serial PRIMARY KEY,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "data" jsonb NOT NULL
);
