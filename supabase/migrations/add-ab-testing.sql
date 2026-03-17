-- A/B Message Testing
-- Adds variant tracking to dm_sent_log and per-variant attribution to dm_link_codes.

-- ab_variant column on dm_sent_log
-- Stores which variant ('A' or 'B') was sent, or NULL for non-AB automations.
ALTER TABLE dm_sent_log
ADD COLUMN IF NOT EXISTS ab_variant text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_dm_sent_log_ab_variant
    ON dm_sent_log (automation_id, ab_variant)
    WHERE ab_variant IS NOT NULL;

-- ab_variant column on dm_link_codes
-- Lets us attribute clicks to variant A or B.
ALTER TABLE dm_link_codes
ADD COLUMN IF NOT EXISTS ab_variant text DEFAULT NULL;
