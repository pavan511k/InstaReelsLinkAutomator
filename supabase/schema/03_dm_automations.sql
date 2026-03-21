-- ============================================================
-- Table: dm_automations
-- One automation per post. Stores the full DM config, trigger
-- rules, and schedule settings for a post's auto-DM campaign.
-- ============================================================

CREATE TABLE IF NOT EXISTS dm_automations (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    post_id         uuid REFERENCES instagram_posts(id) ON DELETE CASCADE NOT NULL,

    -- DM type and full config snapshot
    dm_type         text NOT NULL DEFAULT 'button_template',
    -- 'button_template' | 'message_template' | 'quick_reply' | 'multi_cta'
    -- | 'follow_up' (Follow Gate) | 'email_collector'
    dm_config       jsonb NOT NULL DEFAULT '{}',

    -- Trigger rules (keywords, trigger type, send-once-per-user, etc.)
    trigger_config  jsonb NOT NULL DEFAULT '{}',

    -- Advanced settings (delay, reply text, flow steps, upsell, A/B config, etc.)
    settings_config jsonb NOT NULL DEFAULT '{}',

    -- Lifecycle
    is_active       boolean NOT NULL DEFAULT true,

    -- Optional: automation pauses automatically after this timestamp
    expires_at      timestamptz DEFAULT NULL,

    -- Optional: automation activates automatically at this future timestamp
    scheduled_start_at timestamptz DEFAULT NULL,

    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),

    -- Only one automation per post
    UNIQUE(post_id)
);

-- RLS
ALTER TABLE dm_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own automations"
    ON dm_automations FOR ALL
    USING (auth.uid() = user_id);

-- Webhook: find active automation for a post (hot path — called on every comment)
CREATE INDEX IF NOT EXISTS idx_dm_automations_post_active
    ON dm_automations (post_id)
    WHERE is_active = true;

-- Cron: find active automations whose expiry has passed
CREATE INDEX IF NOT EXISTS idx_dm_automations_expires_at
    ON dm_automations (expires_at)
    WHERE expires_at IS NOT NULL AND is_active = true;

-- Cron: find inactive automations ready to activate
CREATE INDEX IF NOT EXISTS idx_dm_automations_scheduled_start
    ON dm_automations (scheduled_start_at)
    WHERE scheduled_start_at IS NOT NULL AND is_active = false;

-- Analytics: list all automations for a user
CREATE INDEX IF NOT EXISTS idx_dm_automations_user
    ON dm_automations (user_id, updated_at DESC);
