-- =============================================
-- DM Queue — Controlled send pipeline
-- Serves: Excess Queue, Upsell, Backfill (Previous Comments)
-- Run this in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS dm_queue (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Ownership
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id      uuid REFERENCES connected_accounts(id) ON DELETE CASCADE NOT NULL,
    automation_id   text,           -- uuid as text; null for non-automation sends

    -- Target
    post_id         uuid,           -- null ok (upsells have no post context)
    recipient_ig_id text NOT NULL,
    comment_id      text,
    comment_text    text,
    platform        text NOT NULL DEFAULT 'instagram',

    -- Snapshotted DM payload (captured at enqueue time so later edits don't affect queued items)
    dm_type         text NOT NULL DEFAULT 'message_template',
    dm_config       jsonb NOT NULL DEFAULT '{}',
    tracking_map    jsonb NOT NULL DEFAULT '{}',
    user_plan       text NOT NULL DEFAULT 'free',

    -- Queue metadata
    queue_reason    text NOT NULL DEFAULT 'overflow',
    -- overflow | backfill | upsell | retry
    is_upsell       boolean NOT NULL DEFAULT false,
    priority        integer NOT NULL DEFAULT 5,
    -- lower = processed first. overflow=5, backfill=8, upsell=7

    -- Lifecycle
    status          text NOT NULL DEFAULT 'pending',
    -- pending | processing | sent | failed | skipped
    attempts        integer NOT NULL DEFAULT 0,
    max_attempts    integer NOT NULL DEFAULT 3,
    error_message   text,

    created_at      timestamptz DEFAULT now(),
    scheduled_after timestamptz DEFAULT now(),  -- don't process before this time (for upsell delay)
    processed_at    timestamptz
);

ALTER TABLE dm_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue entries
CREATE POLICY "Users view own queue"
    ON dm_queue FOR SELECT
    USING (user_id = auth.uid());

-- Fast cron lookup: pending items ready to process, ordered for fair scheduling
CREATE INDEX IF NOT EXISTS idx_dm_queue_pending
    ON dm_queue(account_id, priority, created_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dm_queue_scheduled
    ON dm_queue(scheduled_after)
    WHERE status = 'pending';

-- Dedup: prevent same (automation, recipient, comment) being queued twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_queue_dedup
    ON dm_queue(automation_id, recipient_ig_id, comment_id)
    WHERE status IN ('pending', 'processing') AND comment_id IS NOT NULL;

-- ── Upsell status column on dm_sent_log ──────────────────────────────────────
-- Tracks whether an upsell follow-up has been sent for each initial DM
ALTER TABLE dm_sent_log
    ADD COLUMN IF NOT EXISTS upsell_status text;
-- null = not applicable/not yet checked
-- 'pending'  = upsell queued / in flight
-- 'sent'     = upsell DM sent
-- 'skipped'  = user clicked, or no upsell configured

-- Index for upsell cron: find rows eligible for upsell processing
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_upsell
    ON dm_sent_log(automation_id, sent_at)
    WHERE status = 'sent' AND upsell_status IS NULL;
