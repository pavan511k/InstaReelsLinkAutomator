-- ============================================================
-- Migration: builder_automation_stats(user_uuid) RPC
-- Why: the /automations list page shows Runs + Clicks columns per
-- automation. Doing this with N+1 count queries against dm_sent_log
-- and click_events would scale poorly; this RPC bundles both
-- aggregates into one round-trip and uses the existing partial
-- indexes (idx_dm_sent_log_automation, idx_click_events_automation).
-- Returns 0/0 for automations that haven't fired or had any clicks
-- so the UI never deals with NULLs.
-- ============================================================

CREATE OR REPLACE FUNCTION builder_automation_stats(user_uuid uuid)
RETURNS TABLE (
    automation_id    uuid,
    runs             bigint,
    clicks           bigint,
    last_run_at      timestamptz
)
LANGUAGE sql
STABLE
AS $$
    WITH user_autos AS (
        SELECT id
        FROM dm_automations
        WHERE user_id = user_uuid
          AND dm_type = 'builder_v2'
    ),
    run_stats AS (
        SELECT
            l.automation_id,
            COUNT(*)::bigint                 AS runs,
            MAX(l.sent_at)                   AS last_run_at
        FROM dm_sent_log l
        JOIN user_autos u ON u.id = l.automation_id
        WHERE l.status = 'sent'
        GROUP BY l.automation_id
    ),
    click_stats AS (
        SELECT
            c.automation_id,
            COUNT(*)::bigint AS clicks
        FROM click_events c
        JOIN user_autos u ON u.id = c.automation_id
        GROUP BY c.automation_id
    )
    SELECT
        a.id                                AS automation_id,
        COALESCE(r.runs, 0)::bigint         AS runs,
        COALESCE(c.clicks, 0)::bigint       AS clicks,
        r.last_run_at                       AS last_run_at
    FROM user_autos a
    LEFT JOIN run_stats   r ON r.automation_id = a.id
    LEFT JOIN click_stats c ON c.automation_id = a.id;
$$;

-- Allow authenticated users to call this; the user_uuid argument
-- locks the result set down to their own automations and the
-- function reads through tables that already have RLS, so a user
-- can't elevate by passing someone else's UUID (RLS on dm_sent_log
-- and click_events would still gate them — but in any case the
-- caller should pass auth.uid() from the server context, which
-- we do in page.js).
GRANT EXECUTE ON FUNCTION builder_automation_stats(uuid) TO authenticated;
