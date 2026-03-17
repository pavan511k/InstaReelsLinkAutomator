-- Alert Preferences
-- Stores per-user limit alert settings.

CREATE TABLE IF NOT EXISTS alert_preferences (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    alert_email     text DEFAULT NULL,       -- send email alert to this address
    webhook_url     text DEFAULT NULL,       -- POST JSON to this URL
    threshold_pct   integer NOT NULL DEFAULT 80
                    CHECK (threshold_pct BETWEEN 50 AND 99),
    alerted_months  text[] NOT NULL DEFAULT '{}',  -- ['2024-12', '2025-01'] prevents re-alert
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_preferences_user ON alert_preferences (user_id);

ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alert preferences"
    ON alert_preferences FOR ALL USING (user_id = auth.uid());
