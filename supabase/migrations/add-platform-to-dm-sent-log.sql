-- Adds platform to dm_sent_log so each DM record carries an explicit
-- 'instagram' | 'facebook' tag. Previously platform had to be inferred
-- through the automation → post chain, which broke for story-mention
-- DMs (no automation_id) and produced ambiguous results when the user's
-- connected account was 'both'. Captured at every insert site.

ALTER TABLE dm_sent_log
    ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'instagram';

-- Helpful for the DM Logs platform filter chip queries.
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_platform
    ON dm_sent_log (platform);
