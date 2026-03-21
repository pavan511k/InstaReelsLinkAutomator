-- =============================================
-- Global Automations — Account-wide triggers
-- Run this in Supabase SQL Editor
-- =============================================

-- A global automation fires on ANY comment across ALL posts/reels for the account
-- when a keyword matches, without needing per-post setup.
CREATE TABLE IF NOT EXISTS global_automations (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id  uuid REFERENCES connected_accounts(id) ON DELETE CASCADE NOT NULL,

    -- Display
    name        text NOT NULL DEFAULT 'Global Trigger',

    -- DM configuration (same structure as dm_automations.dm_config)
    dm_type     text NOT NULL DEFAULT 'message_template',
    dm_config   jsonb NOT NULL DEFAULT '{}',

    -- Trigger configuration (keywords, trigger_type, etc.)
    trigger_config  jsonb NOT NULL DEFAULT '{}',

    -- Behaviour
    is_active           boolean NOT NULL DEFAULT true,
    send_once_per_user  boolean NOT NULL DEFAULT true,
    -- If true, skips firing when the post already has its own active automation
    skip_if_post_has_automation boolean NOT NULL DEFAULT true,

    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

ALTER TABLE global_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own global automations"
    ON global_automations FOR ALL
    USING (auth.uid() = user_id);

-- Fast lookup in webhook: all active global automations for an account
CREATE INDEX IF NOT EXISTS idx_global_automations_account_active
    ON global_automations(account_id)
    WHERE is_active = true;

-- Dedup index for global trigger sent log
-- Reuses dm_sent_log — global automation rows have automation_id = global automation id
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_global_dedup
    ON dm_sent_log(automation_id, recipient_ig_id)
    WHERE status = 'sent';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_global_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_global_automations_updated_at
    BEFORE UPDATE ON global_automations
    FOR EACH ROW EXECUTE FUNCTION update_global_automations_updated_at();
