-- Migration: reconnect-warning dedup marker on connected_accounts.
-- Mirrors the column added to schema/01_connected_accounts.sql. Idempotent.
--
-- Used by the /api/cron/refresh-tokens job: when an Instagram long-lived token
-- can't be auto-refreshed (expired / revoked), we email the owner to reconnect
-- and stamp this column so we don't re-email every run. Cleared on a
-- successful refresh or when the account is reconnected.

ALTER TABLE connected_accounts
    ADD COLUMN IF NOT EXISTS token_expiry_notified_at timestamptz DEFAULT NULL;
