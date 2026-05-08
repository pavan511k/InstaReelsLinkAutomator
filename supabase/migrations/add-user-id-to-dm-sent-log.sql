-- ============================================================
-- Add `user_id` to dm_sent_log so DM attribution survives
-- automation deletions.
--
-- Why: dm_sent_log.automation_id has ON DELETE SET NULL, so
-- deleting an automation orphans its sent-log rows. Read paths
-- that filter by automation ownership (dashboard counts, /api/logs)
-- then undercount, while the cached counter on user_plans
-- (incremented on insert and never decremented) stays high. Result:
-- sidebar shows N, dashboard shows N-X. This migration makes
-- user_id the source of truth so both agree.
--
-- Idempotent (CREATE / ALTER / DROP IF (NOT) EXISTS).
-- ============================================================

-- 1. Column. Nullable initially so the migration is non-blocking;
--    can be tightened to NOT NULL later once we are confident every
--    insert path populates it.
ALTER TABLE dm_sent_log
    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Index for "all DMs for this user" queries (dashboard, logs).
CREATE INDEX IF NOT EXISTS idx_dm_sent_log_user_listing
    ON dm_sent_log (user_id, sent_at DESC);

-- 3. Backfill — try the automation path first, then fall back to the
--    post path for story-mention rows (automation_id NULL by design).
--    Rows that can't be resolved either way (orphaned + no post) stay
--    NULL — historical noise that the dashboard will not count, which
--    is acceptable since we have no way to attribute them.
UPDATE dm_sent_log d
SET user_id = a.user_id
FROM dm_automations a
WHERE d.automation_id = a.id
  AND d.user_id IS NULL;

UPDATE dm_sent_log d
SET user_id = ca.user_id
FROM instagram_posts p
JOIN connected_accounts ca ON ca.id = p.account_id
WHERE d.post_id = p.id
  AND d.user_id IS NULL;

-- 4. BEFORE INSERT trigger — auto-populates user_id when an insert
--    site doesn't provide it. Lets us migrate insert paths gradually
--    without a flag day. New code that already passes user_id skips
--    the lookup (NEW.user_id IS NOT NULL).
CREATE OR REPLACE FUNCTION trigger_dm_sent_log_set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Path 1: derive from automation
    IF NEW.automation_id IS NOT NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM dm_automations
        WHERE id = NEW.automation_id;
    END IF;

    -- Path 2: fall back to post → connected_account (story mentions)
    IF NEW.user_id IS NULL AND NEW.post_id IS NOT NULL THEN
        SELECT ca.user_id INTO NEW.user_id
        FROM instagram_posts p
        JOIN connected_accounts ca ON ca.id = p.account_id
        WHERE p.id = NEW.post_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_dm_sent_log_set_user_id ON dm_sent_log;
CREATE TRIGGER tr_dm_sent_log_set_user_id
    BEFORE INSERT ON dm_sent_log
    FOR EACH ROW
    EXECUTE FUNCTION trigger_dm_sent_log_set_user_id();

-- 5. Refresh the existing cache-increment trigger so it reads the new
--    user_id column directly instead of joining through dm_automations.
--    Faster and works for story-mention rows now that user_id is set.
CREATE OR REPLACE FUNCTION trigger_increment_user_dm_count()
RETURNS TRIGGER AS $$
DECLARE
    v_month text := to_char(NEW.sent_at, 'YYYY-MM');
BEGIN
    IF NEW.status != 'sent' THEN
        RETURN NEW;
    END IF;
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    UPDATE user_plans
    SET monthly_dm_count = CASE
            WHEN dm_count_month = v_month THEN monthly_dm_count + 1
            ELSE 1
        END,
        dm_count_month = v_month
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. RLS update. The old policy filtered by automation ownership,
--    which would hide a user's own rows whose automation_id became
--    NULL. The new one matches the user_id column directly.
DROP POLICY IF EXISTS "Users view own DM logs" ON dm_sent_log;
CREATE POLICY "Users view own DM logs"
    ON dm_sent_log FOR SELECT
    USING (user_id = auth.uid());
