-- Adds partial unique indexes to dm_followup_queue and email_collect_queue
-- so concurrent webhook deliveries can't double-claim a recipient mid-flow.
--
-- Why: Meta retries webhooks within 1-2s on slow handlers, so the same
-- comment_id can arrive 2-3 times in parallel. Without an atomic dedup
-- boundary, the gate-DM or email-ask DM fires N times before any of the
-- parallel SELECT pre-checks observe each other's INSERT. Mirrors the
-- fix already in place for dm_queue via idx_dm_queue_dedup.
--
-- After this migration, the webhook handler can INSERT first, catch 23505
-- (unique-violation) on losers, and only send the DM from the winning
-- delivery -- giving each path the same atomic protection as the main
-- comment-trigger DM flow.
--
-- Precheck (run first): no in-flight duplicates can exist or this migration
-- will fail. Both tables are normally gated by a SELECT-existing check in
-- the webhook handler, so you most likely have none. If either query
-- returns rows, clean them up before applying.
--
--   SELECT automation_id, recipient_ig_id, COUNT(*)
--     FROM dm_followup_queue
--     WHERE status = 'awaiting_confirmation'
--     GROUP BY 1, 2 HAVING COUNT(*) > 1;
--
--   SELECT automation_id, recipient_ig_id, COUNT(*)
--     FROM email_collect_queue
--     WHERE status = 'awaiting_email'
--     GROUP BY 1, 2 HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_queue_unique_inflight
    ON dm_followup_queue (automation_id, recipient_ig_id)
    WHERE status = 'awaiting_confirmation';

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_queue_unique_inflight
    ON email_collect_queue (automation_id, recipient_ig_id)
    WHERE status = 'awaiting_email';
