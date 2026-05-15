-- ============================================================
-- Auto-populate dm_sent_log on insert
--
-- Extends the existing tr_dm_sent_log_set_user_id trigger to fill
-- three derived columns the application code doesn't always pass:
--
--   1. user_id              (existing behavior)
--   2. workspace_id         (new, for the /logs UI scoping)
--   3. recipient_username + recipient_first_name (new, for synthetic
--      button-tap / follow-confirm rows whose Meta webhook payload
--      doesn't carry @-handles; we carry-forward from the most
--      recent prior row for the same automation + recipient)
--
-- All three resolutions are derived from chains that already exist
-- in the row's data, so any insert site benefits without code change.
--
-- Also backfills historical rows that pre-date this trigger version.
--
-- Idempotent. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_dm_sent_log_set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    -- ── user_id resolution (existing) ───────────────────────────
    IF NEW.user_id IS NULL AND NEW.automation_id IS NOT NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM dm_automations
        WHERE id = NEW.automation_id;
    END IF;

    IF NEW.user_id IS NULL AND NEW.post_id IS NOT NULL THEN
        SELECT ca.user_id INTO NEW.user_id
        FROM instagram_posts p
        JOIN connected_accounts ca ON ca.id = p.account_id
        WHERE p.id = NEW.post_id;
    END IF;

    -- ── workspace_id resolution ─────────────────────────────────
    -- Independent of user_id — a caller may pre-set one but not the
    -- other.
    IF NEW.workspace_id IS NULL AND NEW.automation_id IS NOT NULL THEN
        SELECT workspace_id INTO NEW.workspace_id
        FROM dm_automations
        WHERE id = NEW.automation_id;
    END IF;

    IF NEW.workspace_id IS NULL AND NEW.post_id IS NOT NULL THEN
        SELECT ca.workspace_id INTO NEW.workspace_id
        FROM instagram_posts p
        JOIN connected_accounts ca ON ca.id = p.account_id
        WHERE p.id = NEW.post_id;
    END IF;

    -- ── recipient name carry-forward ────────────────────────────
    -- Synthetic rows ([opening tap: …], [follow gate confirmed: …],
    -- [chip tap: …]) are written when a fan taps a button inside a
    -- DM. Meta delivers those as messaging_postbacks, which don't
    -- carry a from.username field. We have the username from the
    -- recipient's earlier comment though — look it up so /logs and
    -- /contacts render the handle instead of "Unknown user".
    --
    -- Only fires when both name fields are unset, so a caller that
    -- explicitly passed a username always wins over the carry-forward.
    IF NEW.recipient_username IS NULL
       AND NEW.recipient_first_name IS NULL
       AND NEW.automation_id IS NOT NULL
       AND NEW.recipient_ig_id IS NOT NULL THEN
        SELECT recipient_username, recipient_first_name
        INTO NEW.recipient_username, NEW.recipient_first_name
        FROM dm_sent_log
        WHERE automation_id = NEW.automation_id
          AND recipient_ig_id = NEW.recipient_ig_id
          AND (recipient_username IS NOT NULL OR recipient_first_name IS NOT NULL)
        ORDER BY sent_at DESC
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach the trigger so it picks up the new function body.
DROP TRIGGER IF EXISTS tr_dm_sent_log_set_user_id ON dm_sent_log;
CREATE TRIGGER tr_dm_sent_log_set_user_id
    BEFORE INSERT ON dm_sent_log
    FOR EACH ROW
    EXECUTE FUNCTION trigger_dm_sent_log_set_user_id();

-- ── Backfill workspace_id on rows that slipped through ─────────
UPDATE dm_sent_log s SET workspace_id = a.workspace_id
FROM dm_automations a
WHERE a.id = s.automation_id
  AND s.workspace_id IS NULL
  AND a.workspace_id IS NOT NULL;

-- Story-mention / chip-tap rows have automation_id NULL but post_id
-- set. Fall back to the post → account chain for those.
UPDATE dm_sent_log s SET workspace_id = ca.workspace_id
FROM instagram_posts p
JOIN connected_accounts ca ON ca.id = p.account_id
WHERE p.id = s.post_id
  AND s.workspace_id IS NULL
  AND ca.workspace_id IS NOT NULL;

-- ── Backfill recipient_username / recipient_first_name on
-- historical synthetic rows. For each (automation_id, recipient_ig_id)
-- pair, find the most recent row that has a captured name and copy
-- it onto every row in the group that's missing both fields.
UPDATE dm_sent_log s SET
    recipient_username   = COALESCE(s.recipient_username,   src.recipient_username),
    recipient_first_name = COALESCE(s.recipient_first_name, src.recipient_first_name)
FROM (
    SELECT DISTINCT ON (automation_id, recipient_ig_id)
        automation_id, recipient_ig_id, recipient_username, recipient_first_name
    FROM dm_sent_log
    WHERE automation_id IS NOT NULL
      AND recipient_ig_id IS NOT NULL
      AND (recipient_username IS NOT NULL OR recipient_first_name IS NOT NULL)
    ORDER BY automation_id, recipient_ig_id, sent_at DESC
) src
WHERE s.automation_id   = src.automation_id
  AND s.recipient_ig_id = src.recipient_ig_id
  AND s.recipient_username IS NULL
  AND s.recipient_first_name IS NULL;
