-- =============================================
-- Trial System + Plan Expiry Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add trial_ends_at — set when account first connects (30-day free Pro trial)
ALTER TABLE connected_accounts
    ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- 2. Add plan_expires_at — set when a paid subscription is activated (1 month from payment)
ALTER TABLE connected_accounts
    ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

-- 3. Backfill: give all existing free-plan users who are already connected a trial
--    (30 days from now so current users aren't immediately penalised)
UPDATE connected_accounts
    SET trial_ends_at = now() + interval '30 days'
    WHERE plan = 'free'
      AND trial_ends_at IS NULL
      AND is_active = true;

-- Verify:
-- SELECT ig_username, plan, trial_ends_at, plan_expires_at FROM connected_accounts;
