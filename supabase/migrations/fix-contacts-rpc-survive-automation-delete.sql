-- ============================================================
-- Migration: fix contacts_for_user so contacts survive automation deletion
--
-- Problem: the original RPC (add-contacts-rpc.sql) scoped sent rows
-- by INNER JOIN dm_sent_log -> dm_automations. When the user deletes
-- an automation, dm_sent_log.automation_id is FK-SET-NULL'd and those
-- rows fall out of the join — every contact who only ever engaged
-- with that automation vanishes from /contacts (and their email,
-- last_active, interaction count). Same defect we already fixed on
-- the DM Logs KPI cards earlier today.
--
-- Fix: scope by dm_sent_log.user_id directly (populated by the
-- auto-fill trigger added in 04_dm_sent_log.sql). Use LEFT JOIN on
-- dm_automations only for the automation-name string aggregation,
-- with a "(deleted automation)" placeholder when the FK is null.
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
        -- Scope by user_id directly so contacts survive automation
        -- deletion. The auto-fill trigger on dm_sent_log populates
        -- user_id from automation_id / post_id / explicit insert
        -- value, so every row written by current code has it set.
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
            -- COUNT DISTINCT ignores NULLs by default, so deleted
            -- automations don't bump the count. That matches the
            -- displayed "automation_names" list which collapses
            -- multiple deleted-automation engagements into a single
            -- "(deleted automation)" entry.
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
