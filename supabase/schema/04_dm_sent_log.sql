-- ============================================================
-- Table: dm_sent_log
-- Append-only log of every DM sent (or attempted).
-- Used for deduplication, analytics, retry tracking,
-- A/B attribution, flow step tracking, and upsell state.
-- ============================================================

CREATE TABLE IF NOT EXISTS dm_sent_log (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Direct user attribution. Survives automation deletion (which would
    -- otherwise NULL out automation_id and orphan the row from the user).
    -- Auto-populated by tr_dm_sent_log_set_user_id when callers don't
    -- provide it — gradually being filled in at all insert sites.
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,

    -- automation_id is NULL for story-mention DMs (no linked automation)
    automation_id   uuid REFERENCES dm_automations(id) ON DELETE SET NULL,
    post_id         uuid REFERENCES instagram_posts(id) ON DELETE SET NULL,

    -- Recipient
    recipient_ig_id text NOT NULL,
    -- recipient_username — captured at initial send (when available in the
    -- inbound webhook payload). Used by flow-steps / upsell to personalise
    -- follow-up DMs ({first_name}, {username} placeholders). Nullable because
    -- some events (e.g. story mentions) may not include the handle.
    recipient_username text DEFAULT NULL,
    -- recipient_first_name — display-name first word, fetched from the
    -- Graph API for IG comments (instagram_business_basic) or parsed from
    -- from.name on FB comments. Lets {first_name} substitute to a real
    -- name instead of the handle. Nullable when the API call fails or
    -- the user has no display name set.
    recipient_first_name text DEFAULT NULL,
    -- platform — 'instagram' | 'facebook'. Captured at insert time so the
    -- DM Logs page can filter by platform without fragile joins through
    -- automation → post → connected_account.
    platform        text NOT NULL DEFAULT 'instagram',
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

-- RLS: users view their own logs via direct user_id match.
-- (Old policy filtered by automation ownership which hid rows whose
-- automation had been deleted — see add-user-id-to-dm-sent-log.sql.)
ALTER TABLE dm_sent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own DM logs"
    ON dm_sent_log FOR SELECT
    USING (user_id = auth.uid());

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

-- DM Logs platform-filter chip
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_platform
    ON dm_sent_log (platform);

-- DM Logs page list view: WHERE automation_id IN (...) ORDER BY sent_at DESC
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_listing
    ON dm_sent_log (automation_id, sent_at DESC);

-- Dashboard / Logs page user-scoped queries: WHERE user_id = ? ORDER BY sent_at DESC
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_user_listing
    ON dm_sent_log (user_id, sent_at DESC);

-- Auto-populate derived columns the application code doesn't always
-- pass: user_id, workspace_id, and recipient_username/first_name
-- (the last two for synthetic button-tap rows that Meta delivers as
-- postbacks without a from.username field).
CREATE OR REPLACE FUNCTION trigger_dm_sent_log_set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    -- user_id resolution
    IF NEW.user_id IS NULL AND NEW.automation_id IS NOT NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM dm_automations
        WHERE id = NEW.automation_id;
    END IF;

    IF NEW.user_id IS NULL AND NEW.post_id IS NOT NULL THEN
        SELECT ca.user_id INTO NEW.user_id
        FROM instagram_posts p
        JOIN connected_accounts ca ON ca.id = p.account_id
        WHERE p.id = NEW.post_id;
    END IF;

    -- workspace_id resolution (independent of user_id — caller may
    -- pre-set one but not the other).
    IF NEW.workspace_id IS NULL AND NEW.automation_id IS NOT NULL THEN
        SELECT workspace_id INTO NEW.workspace_id
        FROM dm_automations
        WHERE id = NEW.automation_id;
    END IF;

    IF NEW.workspace_id IS NULL AND NEW.post_id IS NOT NULL THEN
        SELECT ca.workspace_id INTO NEW.workspace_id
        FROM instagram_posts p
        JOIN connected_accounts ca ON ca.id = p.account_id
        WHERE p.id = NEW.post_id;
    END IF;

    -- Carry-forward recipient handle for synthetic rows
    -- ([opening tap: …], [follow gate confirmed: …], etc.). Postback
    -- webhooks don't carry the username, but a prior comment row
    -- under the same automation + recipient does.
    IF NEW.recipient_username IS NULL
       AND NEW.recipient_first_name IS NULL
       AND NEW.automation_id IS NOT NULL
       AND NEW.recipient_ig_id IS NOT NULL THEN
        SELECT recipient_username, recipient_first_name
        INTO NEW.recipient_username, NEW.recipient_first_name
        FROM dm_sent_log
        WHERE automation_id = NEW.automation_id
          AND recipient_ig_id = NEW.recipient_ig_id
          AND (recipient_username IS NOT NULL OR recipient_first_name IS NOT NULL)
        ORDER BY sent_at DESC
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_dm_sent_log_set_user_id ON dm_sent_log;
CREATE TRIGGER tr_dm_sent_log_set_user_id
    BEFORE INSERT ON dm_sent_log
    FOR EACH ROW
    EXECUTE FUNCTION trigger_dm_sent_log_set_user_id();
