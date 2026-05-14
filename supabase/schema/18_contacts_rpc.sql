-- ============================================================
-- RPC: contacts_for_user(user_uuid)
-- Powers the /contacts page. Aggregates every recipient who has
-- received at least one DM from one of the user's automations
-- into a single result row per recipient. One round-trip beats
-- N+1 client-side aggregation.
--
-- Scoping: filters dm_sent_log by user_id directly (populated by
-- the auto-fill trigger in 04_dm_sent_log.sql). Critical: a prior
-- version of this RPC scoped via INNER JOIN to dm_automations,
-- which caused every contact to disappear once their triggering
-- automation was deleted (FK SET NULLs automation_id). Don't
-- revert to that pattern.
-- ============================================================

CREATE OR REPLACE FUNCTION contacts_for_user(user_uuid uuid)
RETURNS TABLE (
    recipient_ig_id     text,
    username            text,
    first_name          text,
    interactions        bigint,
    last_active         timestamptz,
    automation_count    bigint,
    automation_names    text,
    email               text
)
LANGUAGE sql
STABLE
AS $$
    WITH base AS (
        SELECT
            l.recipient_ig_id,
            l.recipient_username,
            l.recipient_first_name,
            l.automation_id,
            l.sent_at
        FROM dm_sent_log l
        WHERE l.user_id = user_uuid
          AND l.status = 'sent'
          AND l.recipient_ig_id IS NOT NULL
    ),
    latest_names AS (
        SELECT DISTINCT ON (recipient_ig_id)
            recipient_ig_id,
            recipient_username   AS username,
            recipient_first_name AS first_name
        FROM base
        WHERE recipient_username IS NOT NULL
        ORDER BY recipient_ig_id, sent_at DESC
    ),
    aggregates AS (
        SELECT
            b.recipient_ig_id,
            COUNT(*)                                AS interactions,
            MAX(b.sent_at)                          AS last_active,
            -- COUNT DISTINCT skips NULLs, so deleted automations
            -- don't bump the count. Matches the automation_names
            -- list which collapses deleted-automation engagements
            -- into a single "(deleted automation)" entry.
            COUNT(DISTINCT b.automation_id)::bigint AS automation_count
        FROM base b
        GROUP BY b.recipient_ig_id
    ),
    automation_lists AS (
        -- LEFT JOIN: a recipient may have engaged with automations
        -- that have since been deleted. Display "(deleted automation)"
        -- so the contact entry is still useful.
        SELECT
            b.recipient_ig_id,
            string_agg(
                DISTINCT COALESCE(
                    NULLIF(a.settings_config->>'automationName', ''),
                    CASE
                        WHEN b.automation_id IS NULL THEN '(deleted automation)'
                        ELSE 'Untitled automation'
                    END
                ),
                ', '
            ) AS automation_names
        FROM base b
        LEFT JOIN dm_automations a ON a.id = b.automation_id
        GROUP BY b.recipient_ig_id
    ),
    leads AS (
        SELECT DISTINCT ON (recipient_ig_id)
            recipient_ig_id, email
        FROM email_leads
        WHERE user_id = user_uuid
        ORDER BY recipient_ig_id, confirmed_at DESC
    )
    SELECT
        ag.recipient_ig_id,
        ln.username,
        ln.first_name,
        ag.interactions,
        ag.last_active,
        ag.automation_count,
        al.automation_names,
        l.email
    FROM aggregates ag
    LEFT JOIN latest_names      ln ON ln.recipient_ig_id = ag.recipient_ig_id
    LEFT JOIN automation_lists  al ON al.recipient_ig_id = ag.recipient_ig_id
    LEFT JOIN leads             l  ON l.recipient_ig_id  = ag.recipient_ig_id
    ORDER BY ag.last_active DESC;
$$;

GRANT EXECUTE ON FUNCTION contacts_for_user(uuid) TO authenticated;
