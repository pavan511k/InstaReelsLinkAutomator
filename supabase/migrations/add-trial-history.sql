-- Migration: add trial_history — "one free trial per email, ever" ledger.
-- Mirrors supabase/schema/21_trial_history.sql. Idempotent; safe to re-run.
--
-- Why: a 30-day Pro trial is granted per new auth.users id, so deleting the
-- account and re-signing up mints a fresh trial indefinitely. The trial
-- provisioner (src/lib/provision-new-user.js) now records a one-way hash of
-- the email here on first grant, and skips the trial on any repeat.

CREATE TABLE IF NOT EXISTS trial_history (
    email_hash     text PRIMARY KEY,
    first_trial_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trial_history ENABLE ROW LEVEL SECURITY;
