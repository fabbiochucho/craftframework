-- Server-verified video watching: the programme team records each module video's length, and the server credits a
-- learner's playback from position reports while the video plays (src/lib/videoWatch.ts).
-- Additive: one nullable column and a new table. Nothing here changes an existing row.
ALTER TABLE "training_modules" ADD COLUMN IF NOT EXISTS "video_seconds" integer CHECK ("video_seconds" IS NULL OR "video_seconds" > 0);
CREATE TABLE IF NOT EXISTS "training_watch_sessions" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"module_id" text NOT NULL,
	"video_id" text NOT NULL,
	"video_seconds" integer NOT NULL CHECK ("video_seconds" > 0),
	"last_pos" double precision NOT NULL DEFAULT 0,
	"last_at" timestamp with time zone NOT NULL DEFAULT now(),
	"buckets" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "training_watch_sessions_email_module_idx" ON "training_watch_sessions" ("email", "module_id");
