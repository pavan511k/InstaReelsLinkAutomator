-- =============================================
-- Drop plan columns from connected_accounts
-- Plans now live exclusively in user_plans.
-- Run this AFTER add-user-plans.sql.
-- =============================================

ALTER TABLE connected_accounts
    DROP COLUMN IF EXISTS plan,
    DROP COLUMN IF EXISTS plan_expires_at,
    DROP COLUMN IF EXISTS trial_ends_at;
