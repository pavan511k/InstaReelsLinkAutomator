-- ============================================================
-- Table: dm_queue
-- Controlled send pipeline. Instead of sending DMs inline
-- on every webhook event, they are enqueued here and drained
-- by the process-queue cron every 5 minutes.
--
-- Serves: overflow (rate-limit protection), backfill
--         (previous comments), upsell follow-ups,
--         and multi-step flow follow-ups.
-- ============================================================

CREATE TABLE IF NOT EXISTS dm_queue (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Ownership
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id      uuid REFERENCES connected_accounts(id) ON DELETE CASCADE NOT NULL,
    automation_id   text,           -- UUID as text; NULL for non-automation sends

    -- Target
    post_id         uuid,           -- NULL ok (upsells have no post context)
    recipient_ig_id text NOT NULL,
    comment_id      text,
    comment_text    text,
    platform        text NOT NULL DEFAULT 'instagram',

    -- Snapshotted DM payload (captured at enqueue time so later edits don't affect queued items)
    dm_type         text NOT NULL DEFAULT 'message_template',
    dm_config       jsonb NOT NULL DEFAULT '{}',
    tracking_map    jsonb NOT NULL DEFAULT '{}',
    user_plan       text NOT NULL DEFAULT 'free',   -- snapshot for billing gate in cron

    -- Queue metadata
    queue_reason    text NOT NULL DEFAULT 'overflow',
    -- 'overflow' | 'backfill' | 'upsell' | 'flow_step'
    is_upsell       boolean NOT NULL DEFAULT false,
    priority        integer NOT NULL DEFAULT 5,
    -- Lower value = processed first: overflow=5, flow_step=6, upsell=7, backfill=8

    -- Flow step tracking (for multi-step sequences)
    source_log_id   uuid REFERENCES dm_sent_log(id) ON DELETE SET NULL,
    flow_step_index integer,        -- 0=initial, 1=step 1, 2=step 2…

    -- Lifecycle
    status          text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'processing' | 'sent' | 'failed' | 'skipped'
    attempts        integer NOT NULL DEFAULT 0,
    max_attempts    integer NOT NULL DEFAULT 3,
    error_message   text,

    created_at      timestamptz DEFAULT now(),
    scheduled_after timestamptz DEFAULT now(),  -- don't process before this time
    processed_at    timestamptz
);

-- RLS
ALTER TABLE dm_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own queue"
    ON dm_queue FOR SELECT
    USING (user_id = auth.uid());

-- Cron: pending items ready to process, ordered by priority then age
CREATE INDEX IF NOT EXISTS idx_dm_queue_pending
    ON dm_queue (account_id, priority, created_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dm_queue_scheduled
    ON dm_queue (scheduled_after)
    WHERE status = 'pending';

-- Deduplication: prevent same (automation, recipient, comment) being queued twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_queue_dedup
    ON dm_queue (automation_id, recipient_ig_id, comment_id)
    WHERE status IN ('pending', 'processing') AND comment_id IS NOT NULL;
