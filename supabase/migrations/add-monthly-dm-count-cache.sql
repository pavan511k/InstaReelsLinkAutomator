-- Materialised monthly DM-send counter on user_plans. Replaces the per-request
-- COUNT(*) over dm_sent_log + IN (allIds) pattern that scaled poorly with
-- automation count. Maintained by a trigger on dm_sent_log inserts so we
-- never have to remember to increment from app code.
--
-- Reset semantics:
--   • dm_count_month stores 'YYYY-MM' for the month the counter is currently
--     accumulating against.
--   • When a row inserts in a new month, the trigger resets the counter to 1
--     (the inserting row) and rolls dm_count_month forward.
--   • Readers (api/usage, webhook gates, cron gates) check
--     `dm_count_month === current YYYY-MM` and treat a mismatch as 0.

ALTER TABLE user_plans
    ADD COLUMN IF NOT EXISTS monthly_dm_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS dm_count_month   text    DEFAULT NULL;

-- ── Trigger function ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_increment_user_dm_count()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id uuid;
    v_month   text := to_char(NEW.sent_at, 'YYYY-MM');
BEGIN
    -- Only count successful sends. Failed sends don't burn quota.
    IF NEW.status != 'sent' THEN
        RETURN NEW;
    END IF;

    -- Resolve user via the automation. Story-mention DMs have automation_id
    -- NULL by design — we skip the increment for those (they're rare and
    -- not user-billable under the current limit model).
    IF NEW.automation_id IS NOT NULL THEN
        SELECT user_id INTO v_user_id
        FROM dm_automations
        WHERE id = NEW.automation_id;
    END IF;

    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Atomic increment. Postgres serialises concurrent UPDATEs on the same
    -- row so two webhook-fired sends won't lose a count.
    UPDATE user_plans
    SET monthly_dm_count = CASE
            WHEN dm_count_month = v_month THEN monthly_dm_count + 1
            ELSE 1
        END,
        dm_count_month = v_month
    WHERE user_id = v_user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Trigger ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_dm_sent_log_count ON dm_sent_log;
CREATE TRIGGER tr_dm_sent_log_count
    AFTER INSERT ON dm_sent_log
    FOR EACH ROW
    EXECUTE FUNCTION trigger_increment_user_dm_count();
