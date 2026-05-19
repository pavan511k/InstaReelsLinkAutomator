-- =============================================
-- Multi-Account + Soft Disconnect Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add is_active flag (soft disconnect)
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Unique constraint: one active account per user per platform
-- SUPERSEDED by supabase/migrations/drop-unique-active-user-platform.sql
-- (workspace-scoped uniqueness). The per-user scope became wrong once
-- workspaces were introduced -- a user owns N workspaces and can have
-- one Instagram per workspace. Left commented for historical context;
-- re-running this file on a fresh DB no longer creates the obsolete
-- index.
-- CREATE UNIQUE INDEX IF NOT EXISTS unique_active_user_platform
--   ON connected_accounts(user_id, platform)
--   WHERE is_active = true;

-- 3. Update schema.sql reference (the schema file is the source of truth)
-- This migration adds:
--   is_active boolean DEFAULT true
-- And ensures only one active account per user per platform
