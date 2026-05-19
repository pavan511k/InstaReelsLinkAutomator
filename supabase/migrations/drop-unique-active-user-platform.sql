-- ============================================================
-- Replace legacy per-user uniqueness with per-workspace uniqueness
-- on connected_accounts.
--
-- The legacy index `unique_active_user_platform` (created by
-- supabase/migration-multi-account.sql) enforced "one active
-- account per user per platform" globally. With workspaces
-- (schema/19_workspaces.sql), the unit of isolation is the
-- workspace -- a single user owns multiple workspaces and can
-- legitimately have one Instagram account per workspace
-- (different IG accounts in different workspaces).
--
-- The OAuth callback already enforces "one active platform per
-- workspace" at the application layer (callback/route.js looks
-- up by workspace_id + platform and updates instead of inserting).
-- This new index makes the DB invariant match.
--
-- Cross-workspace uniqueness of the SAME Meta account
-- (e.g. preventing the same ig_user_id from being connected to
-- two workspaces at once) is enforced separately by
-- `uq_connected_accounts_ig_user` and `uq_connected_accounts_fb_page`
-- in schema/19_workspaces.sql.
-- ============================================================

DROP INDEX IF EXISTS unique_active_user_platform;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_workspace_platform
    ON connected_accounts (workspace_id, platform)
    WHERE is_active = true;
