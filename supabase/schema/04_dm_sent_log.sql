-- ============================================================
-- Table: dm_sent_log
-- Append-only log of every DM sent (or attempted).
-- Used for deduplication, analytics, retry tracking,
-- A/B attribution, flow step tracking, and upsell state.
-- ============================================================

CREATE TABLE IF NOT EXISTS dm_sent_log (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- automation_id is NULL for story-mention DMs (no linked automation)
    automation_id   uuid REFERENCES dm_automations(id) ON DELETE SET NULL,
    post_id         uuid REFERENCES instagram_posts(id) ON DELETE SET NULL,

    -- Recipient
    recipient_ig_id text NOT NULL,
    comment_id      text,
    comment_text    text,

    -- Result
    status          text NOT NULL DEFAULT 'sent',
    -- 'sent' | 'failed'
    error_message   text,
    sent_at         timestamptz DEFAULT now(),

    -- SendBack retry tracking
    retry_count     integer NOT NULL DEFAULT 0,
    last_retry_at   timestamptz,

    -- A/B test attribution ('A' | 'B' | NULL)
    ab_variant      text DEFAULT NULL,

    -- Upsell follow-up state
    upsell_status   text DEFAULT NULL,
    -- NULL = not applicable / not yet checked
    -- 'pending' = upsell queued or in flight
    -- 'sent'    = upsell DM was sent
    -- 'skipped' = user clicked or no upsell configured

    -- Multi-step flow tracking
    flow_step       integer DEFAULT NULL
    -- NULL  = no flow configured
    -- 0     = initial DM sent; flowSteps[0] is next
    -- N     = flowSteps[N-1] has been enqueued; flowSteps[N] is next
);

-- RLS: users view their own logs (via automation ownership)
ALTER TABLE dm_sent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own DM logs"
    ON dm_sent_log FOR SELECT
    USING (
        automation_id IN (
            SELECT id FROM dm_automations WHERE user_id = auth.uid()
        )
    );

-- Deduplication: prevent sending twice for same (automation, recipient)
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_dedup
    ON dm_sent_log (automation_id, recipient_ig_id);

-- Deduplication: prevent sending twice for same comment
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_comment
    ON dm_sent_log (automation_id, comment_id)
    WHERE comment_id IS NOT NULL;

-- SendBack cron: find retryable failed DMs
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_retry
    ON dm_sent_log (status, retry_count, last_retry_at)
    WHERE status = 'failed';

-- Upsell cron: find rows eligible for upsell processing
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_upsell
    ON dm_sent_log (automation_id, sent_at)
    WHERE status = 'sent' AND upsell_status IS NULL;

-- Flow-steps cron: find rows ready for next step
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_flow_step
    ON dm_sent_log (automation_id, sent_at, flow_step)
    WHERE status = 'sent' AND flow_step IS NOT NULL;

-- A/B analytics
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_ab_variant
    ON dm_sent_log (automation_id, ab_variant)
    WHERE ab_variant IS NOT NULL;

-- Global automation dedup (automation_id is a global_automation uuid, same column)
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_global_dedup
    ON dm_sent_log (automation_id, recipient_ig_id)
    WHERE status = 'sent';
