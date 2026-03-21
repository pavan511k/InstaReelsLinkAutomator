-- ============================================================
-- Table: connected_accounts
-- Stores Instagram / Facebook OAuth credentials and account
-- configuration for each connected social account.
--
-- NOTE: Plan data is NOT stored here.
--       Plans live exclusively in user_plans (table 15).
-- ============================================================

CREATE TABLE IF NOT EXISTS connected_accounts (
    id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Which platform this row represents
    platform                text NOT NULL DEFAULT 'instagram',
    -- 'instagram' | 'facebook' | 'both'

    -- Meta API identifiers
    meta_user_id            text,
    ig_user_id              text,
    ig_username             text,
    ig_profile_picture_url  text,
    fb_page_id              text,
    fb_page_name            text,

    -- OAuth tokens (encrypted at rest by Supabase vault in production)
    access_token            text NOT NULL DEFAULT '',
    fb_page_access_token    text,
    token_expires_at        timestamptz,
    scopes                  text[],

    -- Account state
    is_active               boolean NOT NULL DEFAULT true,

    -- Per-account DM rate limit (DMs per hour sent by the queue processor)
    rate_limit_per_hour     integer NOT NULL DEFAULT 200,

    -- Global defaults for new automations created under this account
    -- { keywords, excludeKeywords, triggerType, defaultMessage, defaultButtonName, utmTag, iceBreakers, mentionDm }
    default_config          jsonb NOT NULL DEFAULT '{}',

    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own connected accounts"
    ON connected_accounts FOR ALL
    USING (auth.uid() = user_id);

-- Fast lookup: all active accounts for a user (used on every page load)
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_active
    ON connected_accounts (user_id)
    WHERE is_active = true;

-- Webhook routing: find account row by IG user ID
CREATE INDEX IF NOT EXISTS idx_connected_accounts_ig_user_id
    ON connected_accounts (ig_user_id)
    WHERE is_active = true;
