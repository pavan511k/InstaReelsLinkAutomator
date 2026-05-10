-- ============================================================
-- Migration: multi-automation + post target mode for the new flow builder
-- Why:
--   1. The new builder lets users attach MULTIPLE automations to the
--      same post (different keyword sets, different DM payloads). The
--      legacy `UNIQUE(post_id)` constraint breaks that.
--   2. The new "Next Post" / "Any Post" target modes don't bind to a
--      specific post at save time, so post_id needs to allow NULL.
-- All previously-saved single-per-post automations remain untouched
-- (the constraint is being relaxed, not enforced retroactively).
-- ============================================================

-- 1. Drop the one-automation-per-post unique constraint. Postgres
--    auto-generates the constraint name from the column list, so we
--    look it up rather than guessing.
DO $$
DECLARE
    cname text;
BEGIN
    SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'dm_automations'::regclass
      AND contype  = 'u'
      AND pg_get_constraintdef(oid) LIKE 'UNIQUE (post_id)%';
    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE dm_automations DROP CONSTRAINT %I', cname);
    END IF;
END$$;

-- 2. Allow NULL post_id so 'Next Post' / 'Any Post' automations save
--    before they're bound to a specific post.
ALTER TABLE dm_automations
    ALTER COLUMN post_id DROP NOT NULL;

-- 3. New index to speed up the webhook's "any-post" lookup. When a
--    comment lands, we ask: are there account-wide automations
--    (post_id IS NULL, post_target_mode='any') for this account?
--    The post_target_mode lives inside trigger_config (jsonb), so a
--    GIN-style expression index would be overkill — a partial btree
--    on user_id + is_active is cheap and good enough.
CREATE INDEX IF NOT EXISTS idx_dm_automations_user_active_unbound
    ON dm_automations (user_id, is_active)
    WHERE post_id IS NULL AND is_active = true;

-- Schema reference: 03_dm_automations.sql is updated separately to
-- match (UNIQUE constraint removed, post_id NULL).
