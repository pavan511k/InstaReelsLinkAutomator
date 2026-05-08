-- Adds recipient_username to dm_sent_log AND dm_queue so flow-step / upsell
-- follow-up DMs can substitute {first_name} and {username} with the actual
-- handle instead of the numeric IGSID. Nullable because we can only capture
-- the username on initial send if it was present in the inbound webhook
-- payload (it usually is for comments; for story-mentions we may need a
-- Graph API lookup which is outside this migration's scope).

ALTER TABLE dm_sent_log
    ADD COLUMN IF NOT EXISTS recipient_username text DEFAULT NULL;

ALTER TABLE dm_queue
    ADD COLUMN IF NOT EXISTS recipient_username text DEFAULT NULL;

-- ─── Atomic dedup for flow-step and upsell enqueue ──────────────────────────
-- The cron loops do a check-then-insert pattern (TOCTOU); two overlapping
-- runs can both pass the in-flight guard and double-enqueue. Add a partial
-- unique index so the database refuses the duplicate, and let the cron
-- catch the unique-violation error and continue.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_queue_flow_upsell_dedup
    ON dm_queue (source_log_id, queue_reason)
    WHERE source_log_id IS NOT NULL
      AND queue_reason IN ('flow_step', 'upsell')
      AND status IN ('pending', 'processing', 'sent');
