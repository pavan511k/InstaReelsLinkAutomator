-- ============================================================
-- Migration: add workspaces feature
--
-- See supabase/schema/19_workspaces.sql for the canonical version.
-- This file is a verbatim copy so it can be pasted into the
-- Supabase SQL editor without external file references.
--
-- What it does:
--   1. Creates workspaces + workspace_members tables
--   2. Creates one "Default" workspace per existing auth.users row
--   3. Adds workspace_id columns to every workspace-scoped table
--   4. Backfills workspace_id from each row's owner's default workspace
--   5. SET NOT NULL on the new columns where safe
--   6. Adds workspace_id indexes
--   7. Adds unique partial indexes on connected_accounts(ig_user_id)
--      and (fb_page_id) so the same Meta account can't live in two
--      workspaces (prevents dual-fire on webhook delivery).
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

-- ── workspaces ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name        text NOT NULL,
    slug        text NOT NULL,
    is_locked   boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner
    ON workspaces (owner_id, created_at);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own workspaces" ON workspaces;
CREATE POLICY "Owners manage own workspaces"
    ON workspaces FOR ALL
    USING (auth.uid() = owner_id);

-- ── workspace_members ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role         text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    added_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user
    ON workspace_members (user_id);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their memberships" ON workspace_members;
CREATE POLICY "Members can read their memberships"
    ON workspace_members FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners manage memberships" ON workspace_members;
CREATE POLICY "Owners manage memberships"
    ON workspace_members FOR ALL
    USING (
        auth.uid() IN (SELECT owner_id FROM workspaces WHERE id = workspace_id)
    );

-- ── Bootstrap default workspaces for existing users ─────────
INSERT INTO workspaces (owner_id, name, slug)
SELECT u.id, 'Default', 'default'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.owner_id = u.id
)
ON CONFLICT DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
)
ON CONFLICT DO NOTHING;

-- ── Add workspace_id to every workspace-scoped table ────────
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE dm_automations     ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE global_automations ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE dm_queue           ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE dm_sent_log        ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE click_events       ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE email_leads        ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE broadcast_jobs     ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- ── Backfill ────────────────────────────────────────────────
UPDATE connected_accounts ca SET workspace_id = (
    SELECT id FROM workspaces WHERE owner_id = ca.user_id ORDER BY created_at LIMIT 1
) WHERE ca.workspace_id IS NULL;

UPDATE dm_automations a SET workspace_id = (
    SELECT id FROM workspaces WHERE owner_id = a.user_id ORDER BY created_at LIMIT 1
) WHERE a.workspace_id IS NULL;

UPDATE global_automations g SET workspace_id = (
    SELECT id FROM workspaces WHERE owner_id = g.user_id ORDER BY created_at LIMIT 1
) WHERE g.workspace_id IS NULL;

UPDATE dm_queue q SET workspace_id = (
    SELECT id FROM workspaces WHERE owner_id = q.user_id ORDER BY created_at LIMIT 1
) WHERE q.workspace_id IS NULL;

UPDATE dm_sent_log s SET workspace_id = (
    SELECT id FROM workspaces WHERE owner_id = s.user_id ORDER BY created_at LIMIT 1
) WHERE s.workspace_id IS NULL AND s.user_id IS NOT NULL;

-- click_events has no user_id column (its schema scopes only via
-- automation_id), so we derive workspace_id via the
-- automation_id → dm_automations.workspace_id chain. dm_automations
-- got its workspace_id from the UPDATE above, so this join is safe.
-- Rows whose automation was hard-deleted stay NULL — they're already
-- orphan analytics rows and workspace_id is nullable on click_events.
UPDATE click_events c SET workspace_id = a.workspace_id
FROM dm_automations a
WHERE a.id = c.automation_id
  AND c.workspace_id IS NULL;

UPDATE email_leads e SET workspace_id = (
    SELECT id FROM workspaces WHERE owner_id = e.user_id ORDER BY created_at LIMIT 1
) WHERE e.workspace_id IS NULL AND e.user_id IS NOT NULL;

UPDATE broadcast_jobs b SET workspace_id = (
    SELECT id FROM workspaces WHERE owner_id = b.user_id ORDER BY created_at LIMIT 1
) WHERE b.workspace_id IS NULL;

-- ── NOT NULL where safe ─────────────────────────────────────
DO $$
BEGIN
    BEGIN ALTER TABLE connected_accounts ALTER COLUMN workspace_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TABLE dm_automations     ALTER COLUMN workspace_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TABLE global_automations ALTER COLUMN workspace_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TABLE dm_queue           ALTER COLUMN workspace_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TABLE broadcast_jobs     ALTER COLUMN workspace_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_connected_accounts_workspace ON connected_accounts (workspace_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_dm_automations_workspace     ON dm_automations     (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_automations_workspace ON global_automations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_dm_queue_workspace           ON dm_queue           (workspace_id);
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_workspace        ON dm_sent_log        (workspace_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_workspace       ON click_events       (workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_leads_workspace        ON email_leads        (workspace_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_workspace     ON broadcast_jobs     (workspace_id);

-- ── Account uniqueness ──────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_connected_accounts_ig_user
    ON connected_accounts (ig_user_id)
    WHERE ig_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_connected_accounts_fb_page
    ON connected_accounts (fb_page_id)
    WHERE fb_page_id IS NOT NULL;
