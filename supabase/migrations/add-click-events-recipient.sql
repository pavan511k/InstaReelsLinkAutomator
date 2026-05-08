-- Migration: add recipient_ig_id to click_events for per-recipient click
-- attribution. Required so cron/upsell can skip recipients who actually
-- clicked the link (genuine "non-clicker" follow-up gating).
--
-- The recipient ID is captured at send-time via a `?r=<igsid>` query param
-- appended to the tracked URL. The /r/[code] route reads the param,
-- records it here, then redirects to the original_url stripped of the
-- tracking query so the destination site never sees it.
--
-- Backfill: existing rows stay NULL. cron/upsell treats NULL as "we don't
-- know if they clicked" and falls through to the existing time-based send,
-- preserving prior behavior for in-flight automations.

ALTER TABLE click_events
    ADD COLUMN IF NOT EXISTS recipient_ig_id text;

CREATE INDEX IF NOT EXISTS idx_click_events_recipient_automation
    ON click_events (automation_id, recipient_ig_id)
    WHERE recipient_ig_id IS NOT NULL;
