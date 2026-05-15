-- ============================================================
-- RPC: contacts_for_workspace(workspace_uuid)
-- Workspace-scoped variant of contacts_for_user. Filters dm_sent_log
-- and email_leads by workspace_id so the /contacts page only shows
-- recipients tied to the active workspace, not every workspace the
-- owner controls.
--
-- Both RPCs are kept side-by-side: callers can pick whichever they
-- need. The original contacts_for_user is left untouched in case any
-- legacy callers still rely on the user-wide aggregation.
-- ============================================================

CREATE OR REPLACE FUNCTION contacts_for_workspace(workspace_uuid uuid)
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
        WHERE l.workspace_id = workspace_uuid
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
            COUNT(DISTINCT b.automation_id)::bigint AS automation_count
        FROM base b
        GROUP BY b.recipient_ig_id
    ),
    automation_lists AS (
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
        WHERE workspace_id = workspace_uuid
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

GRANT EXECUTE ON FUNCTION contacts_for_workspace(uuid) TO authenticated;
