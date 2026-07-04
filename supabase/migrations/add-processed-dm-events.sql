-- Migration: add processed_dm_events — inbound webhook idempotency ledger.
-- Mirrors supabase/schema/20_processed_dm_events.sql. Idempotent; safe to
-- re-run on an existing database.
--
-- Why: ice-breaker replies and quick-reply chip taps had no atomic dedup, so
-- Meta's at-least-once webhook redelivery could send those DMs more than once.
-- The application inserts each inbound event's `mid` here before sending; a
-- redelivery conflicts on the PK and is skipped.

CREATE TABLE IF NOT EXISTS processed_dm_events (
    mid          text PRIMARY KEY,
    processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE processed_dm_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_processed_dm_events_processed_at
    ON processed_dm_events (processed_at);
