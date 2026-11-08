-- Evidence requests from an organisation's independent assessor have no engagement: the request lives
-- while the assessor's access grant on the organisation is active. requested_by is the assessor.
ALTER TABLE "evidence_requests" ALTER COLUMN "engagement_id" DROP NOT NULL;
