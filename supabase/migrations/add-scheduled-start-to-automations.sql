-- Add scheduled_start_at column to dm_automations
-- Allows setting a future date/time for an automation to activate automatically.
-- When scheduled_start_at is set and > now():
--   - is_active is kept false (automation not yet running)
-- When the cron activates it:
--   - is_active = true, scheduled_start_at = NULL (cleared to prevent re-activation)

ALTER TABLE dm_automations
ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz DEFAULT NULL;

-- Index for the activate cron: find inactive automations ready to start
CREATE INDEX IF NOT EXISTS idx_dm_automations_scheduled_start
    ON dm_automations (scheduled_start_at)
    WHERE scheduled_start_at IS NOT NULL AND is_active = false;
