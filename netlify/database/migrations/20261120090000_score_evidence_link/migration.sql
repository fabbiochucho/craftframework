-- A health-security / public-sector catalogue score (NPHI, JEE, SPAR, subnational JEE, PSP) counts as evidenced only
-- when it names a document in the workspace's evidence registry. Older rows keep their stored flag.
ALTER TABLE "governance_scores" ADD COLUMN IF NOT EXISTS "evidence_id" integer;
