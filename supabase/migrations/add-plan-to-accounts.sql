-- Add plan column to connected_accounts
-- This tracks the user's billing plan at the account level.
-- Values: 'free' | 'pro' | 'business'
-- Defaults to 'free'. Set to 'pro' when a user upgrades.

ALTER TABLE connected_accounts
ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- Verify the column was added
-- SELECT id, ig_username, plan FROM connected_accounts LIMIT 5;
