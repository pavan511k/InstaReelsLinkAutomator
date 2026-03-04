-- Migration: Add rate_limit_per_hour and default_config columns to connected_accounts
-- Run this in Supabase SQL Editor

ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS rate_limit_per_hour integer DEFAULT 200;

ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS default_config jsonb DEFAULT '{}';
