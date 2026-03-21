-- =============================================
-- SendBack — Retry Failed DMs
-- Run this in Supabase SQL Editor
-- =============================================

-- Add retry tracking columns to dm_sent_log
ALTER TABLE dm_sent_log
    ADD COLUMN IF NOT EXISTS retry_count     integer     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_retry_at   timestamptz,
    ADD COLUMN IF NOT EXISTS error_message   text;

-- Index for efficient cron queries: find retryable failed DMs
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_retry
    ON dm_sent_log(status, retry_count, last_retry_at)
    WHERE status = 'failed';
