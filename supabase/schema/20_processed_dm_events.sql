-- ============================================================
-- Table: processed_dm_events
-- Idempotency ledger for inbound Instagram/Facebook messaging
-- events (DMs, postbacks). Meta delivers webhooks at-least-once
-- and redelivers the same event (same `mid`) on any non-2xx or
-- transient failure. DM-send paths that have NO stateful row to
-- claim — ice-breaker replies and quick-reply chip taps — insert
-- the event's `mid` here BEFORE sending; a duplicate delivery hits
-- the primary-key conflict and is skipped, so the fan is messaged
-- only once.
--
-- The stateful flows already dedup via their own unique indexes and
-- do NOT use this table: comment→DM (dm_queue idx_dm_queue_dedup),
-- follow gate / opening gate (dm_followup_queue status CAS + unique
-- in-flight indexes).
-- ============================================================

CREATE TABLE IF NOT EXISTS processed_dm_events (
    -- Meta message/postback id (globally unique per event). PRIMARY KEY
    -- gives us the atomic claim via a plain INSERT that conflicts on redelivery.
    mid          text PRIMARY KEY,
    processed_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: written/read only by the webhook via the service-role key (which
-- bypasses RLS). No end user ever touches this table, so RLS is enabled with
-- NO policy — normal authenticated clients get zero access.
ALTER TABLE processed_dm_events ENABLE ROW LEVEL SECURITY;

-- Housekeeping: only the redelivery window matters (minutes–hours). A periodic
-- sweep keeps the table small; safe because a genuine redelivery always lands
-- within Meta's retry window. Run from a cron or manual sweep:
--   DELETE FROM processed_dm_events WHERE processed_at < now() - interval '7 days';
CREATE INDEX IF NOT EXISTS idx_processed_dm_events_processed_at
    ON processed_dm_events (processed_at);
