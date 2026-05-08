-- ============================================================
-- Track which plan_expires_at value the "Pro expiring soon"
-- reminder has already been sent for. Stores the value of
-- plan_expires_at at the time we emailed. If it differs from
-- the current plan_expires_at (e.g. user renewed → expiry moved
-- forward), the cron will re-send for the new expiry.
-- ============================================================
ALTER TABLE user_plans
    ADD COLUMN IF NOT EXISTS expiring_soon_emailed_for_expiry timestamptz;
