-- ============================================================
-- Table: dm_followup_queue
-- Tracks users mid-flow in the Follow Gate automation.
-- When someone comments, we send them a gate DM asking them to
-- follow first. Their "Yes I followed" reply is matched here.
-- ============================================================

CREATE TABLE IF NOT EXISTS dm_followup_queue (
    id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    automation_id           uuid REFERENCES dm_automations(id) ON DELETE CASCADE NOT NULL,
    account_id              uuid REFERENCES connected_accounts(id) ON DELETE CASCADE NOT NULL,

    -- The Instagram user in the follow-gate flow
    recipient_ig_id         text NOT NULL,
    ig_sender_id            text NOT NULL,   -- Our IG Business Account ID (the sender)

    -- Conversation state
    status                  text NOT NULL DEFAULT 'awaiting_confirmation',
    -- 'awaiting_confirmation' | 'link_sent' | 'max_retries_reached' | 'expired'
    retry_count             integer NOT NULL DEFAULT 0,
    max_retries             integer NOT NULL DEFAULT 3,

    -- Messages configured per automation
    gate_message            text NOT NULL,
    nudge_message           text NOT NULL,
    decline_message         text NOT NULL DEFAULT 'No worries! Follow us and tap ✅ Yes whenever you''re ready 🙌',
    confirmation_keywords   text[] NOT NULL DEFAULT ARRAY['yes', 'done', 'followed', 'ok'],

    -- The reward DM to send once follow is verified
    link_dm_type            text NOT NULL DEFAULT 'message_template',
    link_dm_config          jsonb NOT NULL DEFAULT '{}',

    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE dm_followup_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own followup queue"
    ON dm_followup_queue FOR SELECT
    USING (
        automation_id IN (
            SELECT id FROM dm_automations WHERE user_id = auth.uid()
        )
    );

-- Webhook: find a pending follow-gate entry by recipient (hot path)
CREATE INDEX IF NOT EXISTS idx_followup_queue_recipient
    ON dm_followup_queue (recipient_ig_id, status)
    WHERE status = 'awaiting_confirmation';

CREATE INDEX IF NOT EXISTS idx_followup_queue_automation
    ON dm_followup_queue (automation_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_followup_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_followup_queue_updated_at
    BEFORE UPDATE ON dm_followup_queue
    FOR EACH ROW EXECUTE FUNCTION update_followup_queue_updated_at();
