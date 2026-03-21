-- ============================================================
-- Tables: email_collect_queue + email_leads
-- Email Collector automation: when a commenter replies with
-- their email address, it is captured and stored here.
-- Pro/Trial feature.
-- ============================================================

-- ── email_collect_queue ────────────────────────────────────────
-- Tracks users mid-flow who we've asked for their email.

CREATE TABLE IF NOT EXISTS email_collect_queue (
    id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    automation_id           uuid REFERENCES dm_automations(id) ON DELETE CASCADE NOT NULL,
    account_id              uuid REFERENCES connected_accounts(id) ON DELETE CASCADE NOT NULL,
    recipient_ig_id         text NOT NULL,
    ig_sender_id            text NOT NULL,          -- Our IG Business Account ID

    status                  text NOT NULL DEFAULT 'awaiting_email',
    -- 'awaiting_email' | 'email_captured' | 'expired'

    confirmation_message    text NOT NULL DEFAULT 'Thanks! 🎉 We''ve got your email and will be in touch soon.',

    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE email_collect_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own email queue"
    ON email_collect_queue FOR SELECT
    USING (
        automation_id IN (
            SELECT id FROM dm_automations WHERE user_id = auth.uid()
        )
    );

-- Webhook: find pending email collection by recipient (hot path)
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient
    ON email_collect_queue (recipient_ig_id, status)
    WHERE status = 'awaiting_email';

CREATE OR REPLACE FUNCTION update_email_collect_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_collect_queue_updated_at
    BEFORE UPDATE ON email_collect_queue
    FOR EACH ROW EXECUTE FUNCTION update_email_collect_queue_updated_at();


-- ── email_leads ────────────────────────────────────────────────
-- Permanent store of captured email leads.

CREATE TABLE IF NOT EXISTS email_leads (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    automation_id   uuid REFERENCES dm_automations(id) ON DELETE CASCADE NOT NULL,
    account_id      uuid REFERENCES connected_accounts(id) ON DELETE CASCADE NOT NULL,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipient_ig_id text NOT NULL,
    email           text NOT NULL,
    confirmed_at    timestamptz DEFAULT now(),
    created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE email_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own email leads"
    ON email_leads FOR SELECT
    USING (user_id = auth.uid());

-- Prevent duplicate email per automation
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_leads_unique
    ON email_leads (automation_id, recipient_ig_id);

CREATE INDEX IF NOT EXISTS idx_email_leads_account
    ON email_leads (account_id, created_at DESC);
