-- ============================================================
-- Auto-populate click_events.workspace_id on insert
--
-- Same gap as email_leads: the workspace migration added the
-- column as nullable, but the insert site (/r/[code]/route.js)
-- doesn't pass workspace_id. Rows land with workspace_id = NULL,
-- which doesn't break the current /api/clicks UI (it filters by
-- automation_id) but breaks any future workspace-scoped query.
--
-- Resolution: derive workspace_id from automation_id →
-- dm_automations.workspace_id. Mirrors the dm_sent_log /
-- email_leads triggers.
--
-- Idempotent. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_click_events_set_workspace_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.workspace_id IS NULL AND NEW.automation_id IS NOT NULL THEN
        SELECT workspace_id INTO NEW.workspace_id
        FROM dm_automations
        WHERE id = NEW.automation_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_click_events_set_workspace_id ON click_events;
CREATE TRIGGER tr_click_events_set_workspace_id
    BEFORE INSERT ON click_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_click_events_set_workspace_id();
