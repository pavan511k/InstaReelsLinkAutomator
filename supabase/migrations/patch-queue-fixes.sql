-- =============================================
-- Patch: Fix dm_queue missing columns + flow steps support
-- Run this in Supabase SQL Editor
-- =============================================

-- Fix 1: Add source_log_id and flow_step_index to dm_queue
ALTER TABLE dm_queue
    ADD COLUMN IF NOT EXISTS source_log_id    uuid REFERENCES dm_sent_log(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS flow_step_index  integer; -- 0=initial flow DM, 1=step 1, 2=step 2...

-- Fix 2: Add flow step tracking to dm_sent_log
-- Which step of a multi-step flow has been queued for this recipient?
-- NULL = no flow configured, 0 = step 1 enqueued (initial DM), 1 = step 2 queued, etc.
ALTER TABLE dm_sent_log
    ADD COLUMN IF NOT EXISTS flow_step integer;

-- Index for flow-steps cron: find rows ready for next step
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_flow_step
    ON dm_sent_log(automation_id, sent_at, flow_step)
    WHERE status = 'sent' AND flow_step IS NOT NULL;

-- Fix 3: dm_sent_log.automation_id must accept NULL for mention DMs
-- (already nullable from original migration via ON DELETE SET NULL, this is just documentation)
-- The mention handler was trying to insert a synthetic string like 'mention_xxx' which
-- is rejected by UUID type. Fix is in the code — mentions now use NULL automation_id.
