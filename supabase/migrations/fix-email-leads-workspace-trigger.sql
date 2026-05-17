-- ============================================================
-- Auto-populate email_leads.workspace_id on insert
--
-- Mirrors the dm_sent_log workspace-trigger pattern: the webhook
-- upserts an email_leads row but doesn't always carry workspace_id.
-- Without this trigger, those rows land with workspace_id = NULL
-- and never surface on /leads (the page filters by workspace_id).
--
-- Resolution order:
--   1. automation_id → dm_automations.workspace_id
--   2. account_id    → connected_accounts.workspace_id  (fallback;
--      automation_id is ON DELETE SET NULL on email_leads so the
--      lead can outlive its automation)
--
-- Idempotent. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_email_leads_set_workspace_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.workspace_id IS NULL AND NEW.automation_id IS NOT NULL THEN
        SELECT workspace_id INTO NEW.workspace_id
        FROM dm_automations
        WHERE id = NEW.automation_id;
    END IF;

    IF NEW.workspace_id IS NULL AND NEW.account_id IS NOT NULL THEN
        SELECT workspace_id INTO NEW.workspace_id
        FROM connected_accounts
        WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_email_leads_set_workspace_id ON email_leads;
CREATE TRIGGER tr_email_leads_set_workspace_id
    BEFORE INSERT ON email_leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_email_leads_set_workspace_id();
