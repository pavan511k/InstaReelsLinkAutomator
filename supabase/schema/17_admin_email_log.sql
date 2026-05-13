-- ============================================================
-- Table: admin_email_log
-- Audit log for the admin-only ad-hoc email tool (/admin/email).
-- Captures who sent what, to whom, and whether Resend accepted it.
-- Lets the operator review activity without depending on the
-- Resend dashboard (which only shows the API caller's history,
-- not "branded" vs raw, body format, or which UI sent it).
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_email_log (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Who sent it. sender_email is a snapshot so the log entry
    -- survives if the auth.users row is later deleted.
    sent_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_email    text,

    -- Recipients. Arrays so a single send to 12 addresses
    -- stays one row instead of 12 — easier to scan.
    to_addresses    text[] NOT NULL,
    cc_addresses    text[] NOT NULL DEFAULT '{}',
    bcc_addresses   text[] NOT NULL DEFAULT '{}',

    -- Content
    subject         text NOT NULL,
    body_format     text NOT NULL DEFAULT 'html',   -- 'html' | 'text'
    branded_layout  boolean NOT NULL DEFAULT false, -- wrapped in lib/email.js layout()

    -- Result
    status          text NOT NULL DEFAULT 'sent',   -- 'sent' | 'failed'
    resend_id       text,
    error_message   text,

    sent_at         timestamptz DEFAULT now()
);

ALTER TABLE admin_email_log ENABLE ROW LEVEL SECURITY;

-- The operator can read their own log entries. Inserts always go
-- through the API route using the service-role key (bypasses RLS).
CREATE POLICY "Admin reads own email log"
    ON admin_email_log FOR SELECT
    USING (sent_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_admin_email_log_sent_at
    ON admin_email_log (sent_at DESC);
