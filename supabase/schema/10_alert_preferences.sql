-- ============================================================
-- Table: alert_preferences
-- Per-user settings for DM usage limit alerts.
-- When monthly DM usage crosses threshold_pct of the limit,
-- an email and/or webhook is fired.
-- Available on all plans.
-- ============================================================

CREATE TABLE IF NOT EXISTS alert_preferences (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

    alert_email     text DEFAULT NULL,      -- Send alert email to this address (can differ from login email)
    webhook_url     text DEFAULT NULL,      -- POST alert JSON to this URL

    -- Fire alert when (sent_this_month / monthly_limit * 100) >= threshold_pct
    threshold_pct   integer NOT NULL DEFAULT 80
                    CHECK (threshold_pct BETWEEN 50 AND 99),

    -- Months already alerted (prevents re-firing within the same month)
    -- e.g. ['2025-01', '2025-02']
    alerted_months  text[] NOT NULL DEFAULT '{}',

    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alert preferences"
    ON alert_preferences FOR ALL
    USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_alert_preferences_user
    ON alert_preferences (user_id);
