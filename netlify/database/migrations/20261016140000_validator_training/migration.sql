-- Validator system PR 4: training and accreditation programme.
-- Additive only: one new nullable column on validator_profiles plus new tables.
-- Content rows are seeded lazily by /api/training from src/lib/trainingSeed.ts.
ALTER TABLE "validator_profiles" ADD COLUMN IF NOT EXISTS "accredited_until" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "training_staff" (
	"email" text PRIMARY KEY,
	"role" text NOT NULL CHECK ("role" IN ('programme_team', 'lead_validator')),
	"added_by" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "training_settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "training_modules" (
	"id" text PRIMARY KEY,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	"script" text DEFAULT '' NOT NULL,
	"youtube_url" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"exercises" jsonb DEFAULT '[]' NOT NULL,
	"scenario" jsonb,
	"reflection_prompt" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "training_questions" (
	"id" text PRIMARY KEY,
	"module_id" text,
	"topic" text DEFAULT '' NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"for_check" boolean DEFAULT false NOT NULL,
	"for_exam" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "training_cases" (
	"id" text PRIMARY KEY,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"prompt" text NOT NULL,
	"model_answer" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "training_capstones" (
	"id" text PRIMARY KEY,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"brief" text NOT NULL,
	"evidence" jsonb DEFAULT '[]' NOT NULL,
	"reference_scores" jsonb DEFAULT '{}' NOT NULL,
	"model_answer" text DEFAULT '' NOT NULL,
	"rubric" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "training_calibration_items" (
	"id" text PRIMARY KEY,
	"statement" text NOT NULL,
	"reference_score" integer NOT NULL CHECK ("reference_score" BETWEEN 0 AND 5),
	"active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "training_badges" (
	"key" text PRIMARY KEY,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"criteria" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "training_progress" (
	"email" text NOT NULL,
	"module_id" text NOT NULL,
	"step" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"detail" jsonb DEFAULT '{}' NOT NULL,
	PRIMARY KEY ("email", "module_id", "step")
);

CREATE TABLE IF NOT EXISTS "training_activity" (
	"email" text NOT NULL,
	"day" date NOT NULL,
	PRIMARY KEY ("email", "day")
);

CREATE TABLE IF NOT EXISTS "training_drills" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL,
	"purpose" text NOT NULL,
	"within" integer NOT NULL,
	"total" integer NOT NULL,
	"pct" integer NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "training_drills_email_idx" ON "training_drills" ("email");

CREATE TABLE IF NOT EXISTS "training_exam_attempts" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"question_ids" jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"score" integer,
	"total" integer NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"note" text
);
CREATE INDEX IF NOT EXISTS "training_exam_attempts_email_idx" ON "training_exam_attempts" ("email");

CREATE TABLE IF NOT EXISTS "training_submissions" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"kind" text NOT NULL,
	"content_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"body" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_percent" numeric(5, 1),
	CONSTRAINT "training_submissions_attempt_unique" UNIQUE ("email", "kind", "content_id", "attempt")
);
CREATE INDEX IF NOT EXISTS "training_submissions_status_idx" ON "training_submissions" ("status");

CREATE TABLE IF NOT EXISTS "training_marks" (
	"id" serial PRIMARY KEY,
	"submission_id" text NOT NULL REFERENCES "training_submissions"("id") ON DELETE CASCADE,
	"marker" text NOT NULL,
	"scores" jsonb NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_marks_submission_marker_unique" UNIQUE ("submission_id", "marker")
);

CREATE TABLE IF NOT EXISTS "training_cpd" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL,
	"hours" numeric(5, 1) NOT NULL CHECK ("hours" > 0 AND "hours" <= 24),
	"activity" text NOT NULL,
	"occurred_on" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "training_cpd_email_idx" ON "training_cpd" ("email");

CREATE TABLE IF NOT EXISTS "training_declarations" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL,
	"clients" text DEFAULT '' NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "training_declarations_email_idx" ON "training_declarations" ("email");
