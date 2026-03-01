-- DM Automations Tables
-- Run this in Supabase SQL Editor

-- Drop existing tables/policies to avoid schema conflicts with older versions
DROP TABLE IF EXISTS dm_analytics CASCADE;
DROP TABLE IF EXISTS dm_sent_log CASCADE;
DROP TABLE IF EXISTS dm_automations CASCADE;

-- 1. DM Automations Table
CREATE TABLE dm_automations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    post_id uuid REFERENCES instagram_posts(id) NOT NULL,
    dm_type text NOT NULL DEFAULT 'button_template',
    dm_config jsonb NOT NULL DEFAULT '{}',
    trigger_config jsonb NOT NULL DEFAULT '{}',
    settings_config jsonb NOT NULL DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(post_id)
);

ALTER TABLE dm_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own automations"
    ON dm_automations FOR ALL
    USING (auth.uid() = user_id);

-- 2. DM Sent Log (for deduplication + analytics)
CREATE TABLE dm_sent_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    automation_id uuid REFERENCES dm_automations(id) ON DELETE SET NULL,
    post_id uuid REFERENCES instagram_posts(id) ON DELETE SET NULL,
    recipient_ig_id text NOT NULL,
    comment_id text,
    comment_text text,
    status text NOT NULL DEFAULT 'sent',
    error_message text,
    sent_at timestamptz DEFAULT now()
);

ALTER TABLE dm_sent_log ENABLE ROW LEVEL SECURITY;

-- Service role can insert (webhook uses service role)
-- Users can view their own logs
CREATE POLICY "Users view own DM logs"
    ON dm_sent_log FOR SELECT
    USING (
        automation_id IN (
            SELECT id FROM dm_automations WHERE user_id = auth.uid()
        )
    );

-- Allow service role to insert (no RLS restriction for service role)
-- Service role bypasses RLS by default

-- 3. Index for webhook lookups (fast comment → automation matching)
CREATE INDEX IF NOT EXISTS idx_dm_automations_post_active
    ON dm_automations(post_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_dm_sent_log_dedup
    ON dm_sent_log(automation_id, recipient_ig_id);
