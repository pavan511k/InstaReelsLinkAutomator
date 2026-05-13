-- Adds admin_email_log — audit table for the /admin/email tool that
-- sends ad-hoc transactional/announcement emails through Resend.
-- Idempotent: safe to re-run on environments that already have it.

CREATE TABLE IF NOT EXISTS admin_email_log (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    sent_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_email    text,

    to_addresses    text[] NOT NULL,
    cc_addresses    text[] NOT NULL DEFAULT '{}',
    bcc_addresses   text[] NOT NULL DEFAULT '{}',

    subject         text NOT NULL,
    body_format     text NOT NULL DEFAULT 'html',
    branded_layout  boolean NOT NULL DEFAULT false,

    status          text NOT NULL DEFAULT 'sent',
    resend_id       text,
    error_message   text,

    sent_at         timestamptz DEFAULT now()
);

ALTER TABLE admin_email_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'admin_email_log'
          AND policyname = 'Admin reads own email log'
    ) THEN
        CREATE POLICY "Admin reads own email log"
            ON admin_email_log FOR SELECT
            USING (sent_by = auth.uid());
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_admin_email_log_sent_at
    ON admin_email_log (sent_at DESC);
