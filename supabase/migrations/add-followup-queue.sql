-- Follow-up Queue Table
-- Run this in Supabase SQL Editor
-- Tracks users who are in the "follow to get the link" flow

CREATE TABLE IF NOT EXISTS dm_followup_queue (
    id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    automation_id         uuid REFERENCES dm_automations(id) ON DELETE CASCADE NOT NULL,
    account_id            uuid REFERENCES connected_accounts(id) ON DELETE CASCADE NOT NULL,
    recipient_ig_id       text NOT NULL,          -- IG user ID of the commenter
    ig_sender_id          text NOT NULL,           -- Our IG Business Account ID

    -- Conversation state
    status                text NOT NULL DEFAULT 'awaiting_confirmation',
    -- awaiting_confirmation | link_sent | max_retries_reached | expired
    retry_count           integer NOT NULL DEFAULT 0,
    max_retries           integer NOT NULL DEFAULT 3,

    -- Messages configured by the user
    gate_message          text NOT NULL,           -- Initial message with Yes/No reply buttons
    nudge_message         text NOT NULL,           -- Sent when user taps YES but isn't following yet
    decline_message       text NOT NULL DEFAULT 'No worries! Follow us and tap ✅ Yes whenever you''re ready 🙌',
    confirmation_keywords text[] NOT NULL DEFAULT ARRAY['yes', 'done', 'followed', 'ok'],

    -- The reward DM to send when follow is verified
    link_dm_type          text NOT NULL DEFAULT 'message_template',
    link_dm_config        jsonb NOT NULL DEFAULT '{}',

    created_at            timestamptz DEFAULT now(),
    updated_at            timestamptz DEFAULT now()
);

ALTER TABLE dm_followup_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue entries (via automation ownership)
CREATE POLICY "Users view own followup queue"
    ON dm_followup_queue FOR SELECT
    USING (
        automation_id IN (
            SELECT id FROM dm_automations WHERE user_id = auth.uid()
        )
    );

-- Service role handles inserts/updates (webhook runs as service role)

-- Indexes for fast lookups in the webhook handler
CREATE INDEX IF NOT EXISTS idx_followup_queue_recipient
    ON dm_followup_queue(recipient_ig_id, status)
    WHERE status = 'awaiting_confirmation';

CREATE INDEX IF NOT EXISTS idx_followup_queue_automation
    ON dm_followup_queue(automation_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_followup_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_followup_queue_updated_at
    BEFORE UPDATE ON dm_followup_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_followup_queue_updated_at();
