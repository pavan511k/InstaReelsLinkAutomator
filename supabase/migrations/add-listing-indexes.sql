-- ============================================================
-- Add composite indexes for the DM Logs and Click Stats UI
-- queries that filter by automation_id and sort by time.
--
-- Existing indexes on these tables are tuned for cron paths
-- (dedup, retry, upsell). The user-facing list views were
-- doing a full scan + sort which gets slow once an account
-- has more than a few thousand sent DMs / clicks.
--
-- Idempotent (CREATE INDEX IF NOT EXISTS).
-- ============================================================

-- DM Logs page: WHERE automation_id IN (...) ORDER BY sent_at DESC
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_listing
    ON dm_sent_log (automation_id, sent_at DESC);

-- Click stats page: WHERE automation_id = ? ORDER BY clicked_at DESC
CREATE INDEX IF NOT EXISTS idx_click_events_listing
    ON click_events (automation_id, clicked_at DESC);
