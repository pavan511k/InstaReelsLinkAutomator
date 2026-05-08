-- Adds per-recipient retry tracking and the 'throttled' job status.
--
-- broadcast_recipients: retry_count tracks how many times a transient-failed
--   send has been re-queued. The process worker retries up to MAX_RETRIES (3)
--   times before marking a recipient as permanently failed.
--
-- broadcast_jobs: adds 'throttled' status used when Meta returns a rate-limit
--   error code (4, 17, 613). The job auto-resumes after an exponential backoff.

-- ── broadcast_recipients ─────────────────────────────────────────────────────

ALTER TABLE broadcast_recipients
    ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- ── broadcast_jobs — extend status constraint to include 'throttled' ─────────

ALTER TABLE broadcast_jobs
    DROP CONSTRAINT IF EXISTS broadcast_jobs_status_check;

ALTER TABLE broadcast_jobs
    ADD CONSTRAINT broadcast_jobs_status_check
    CHECK (status IN ('pending','running','paused','throttled','completed','failed'));

-- ── Refresh partial index to include 'throttled' rows ────────────────────────

DROP INDEX IF EXISTS idx_broadcast_jobs_status;

CREATE INDEX idx_broadcast_jobs_status
    ON broadcast_jobs (status)
    WHERE status IN ('running', 'pending', 'throttled');
