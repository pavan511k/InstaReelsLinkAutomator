-- Add expires_at column to dm_automations
-- Allows setting an automatic stop date on any automation.
-- When expires_at is set and <= now(), the cron job (or webhook) will pause the automation.

ALTER TABLE dm_automations
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

-- Index for the cron job query: find active automations whose expiry has passed
CREATE INDEX IF NOT EXISTS idx_dm_automations_expires_at
    ON dm_automations (expires_at)
    WHERE expires_at IS NOT NULL AND is_active = true;

-- Verify
-- SELECT id, post_id, is_active, expires_at FROM dm_automations WHERE expires_at IS NOT NULL;
