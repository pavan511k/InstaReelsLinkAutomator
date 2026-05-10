-- ============================================================
-- Migration: contacts_for_user(user_uuid) RPC
-- Why: the /contacts page aggregates every recipient who has
-- received at least one DM from one of the user's automations.
-- We GROUP BY recipient_ig_id and pull a contact's most-recent
-- username/first_name (sometimes the username changed between
-- automations and we want the freshest), interaction count,
-- last-active timestamp, comma-joined list of automation names
-- they've engaged with, and any captured email.
-- One round-trip beats N+1 client-side aggregation.
-- ============================================================

-- ── Column dependencies ─────────────────────────────────────
-- The RPC below reads recipient_username and recipient_first_name
-- from dm_sent_log. Both columns were added in earlier migrations
-- (add-recipient-username-to-dm-sent-log.sql,
--  add-recipient-first-name.sql) but databases that only ever
-- received this contacts RPC migration would error on
-- "column does not exist". The IF NOT EXISTS guards below make
-- this migration self-contained and idempotent on any state.
ALTER TABLE dm_sent_log
    ADD COLUMN IF NOT EXISTS recipient_username   text DEFAULT NULL;

ALTER TABLE dm_sent_log
    ADD COLUMN IF NOT EXISTS recipient_first_name text DEFAULT NULL;

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
    WITH user_autos AS (
        SELECT id, settings_config
        FROM dm_automations
        WHERE user_id = user_uuid
    ),
    -- All sent DM rows scoped to this user's automations.
    base AS (
        SELECT
            l.recipient_ig_id,
            l.recipient_username,
            l.recipient_first_name,
            l.automation_id,
            l.sent_at
        FROM dm_sent_log l
        JOIN user_autos a ON a.id = l.automation_id
        WHERE l.status = 'sent'
          AND l.recipient_ig_id IS NOT NULL
    ),
    -- Latest username/first-name per recipient (window function picks
    -- the most-recent non-null value to handle username changes and
    -- legacy rows that didn't capture the display fields).
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
            COUNT(*)                              AS interactions,
            MAX(b.sent_at)                        AS last_active,
            COUNT(DISTINCT b.automation_id)::bigint AS automation_count
        FROM base b
        GROUP BY b.recipient_ig_id
    ),
    automation_lists AS (
        -- Aggregate the automation names this contact has engaged
        -- with into a single comma-joined string. Pull the display
        -- name from settings_config.automationName, falling back to
        -- a placeholder if the row predates the new builder.
        SELECT
            b.recipient_ig_id,
            string_agg(
                DISTINCT COALESCE(NULLIF(a.settings_config->>'automationName', ''), 'Untitled automation'),
                ', '
            ) AS automation_names
        FROM base b
        JOIN user_autos a ON a.id = b.automation_id
        GROUP BY b.recipient_ig_id
    ),
    leads AS (
        -- Latest captured email per recipient (a recipient may have
        -- given email more than once via multiple automations; pick
        -- the most recent).
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
