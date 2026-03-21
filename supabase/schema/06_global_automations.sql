-- ============================================================
-- Table: global_automations
-- Account-wide keyword triggers that fire on ANY post/reel
-- comment without per-post setup.
-- Pro/Trial feature.
-- ============================================================

CREATE TABLE IF NOT EXISTS global_automations (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id      uuid REFERENCES connected_accounts(id) ON DELETE CASCADE NOT NULL,

    -- Display name (shown in Settings UI)
    name            text NOT NULL DEFAULT 'Global Trigger',

    -- DM payload (same structure as dm_automations.dm_config)
    dm_type         text NOT NULL DEFAULT 'message_template',
    dm_config       jsonb NOT NULL DEFAULT '{}',

    -- Trigger rules
    trigger_config  jsonb NOT NULL DEFAULT '{}',

    -- Behaviour flags
    is_active               boolean NOT NULL DEFAULT true,
    send_once_per_user      boolean NOT NULL DEFAULT true,
    -- Skip firing if the post already has its own active per-post automation
    skip_if_post_has_automation boolean NOT NULL DEFAULT true,

    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE global_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own global automations"
    ON global_automations FOR ALL
    USING (auth.uid() = user_id);

-- Webhook: load all active global automations for an account on each comment
CREATE INDEX IF NOT EXISTS idx_global_automations_account_active
    ON global_automations (account_id)
    WHERE is_active = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_global_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_global_automations_updated_at
    BEFORE UPDATE ON global_automations
    FOR EACH ROW EXECUTE FUNCTION update_global_automations_updated_at();
