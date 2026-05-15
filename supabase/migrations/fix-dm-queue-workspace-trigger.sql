-- ============================================================
-- Auto-populate dm_queue.workspace_id on insert
--
-- Phase 1 added workspace_id (NOT NULL) to dm_queue, but the
-- application code inserting rows doesn't always set it. Without
-- this trigger, the webhook fails to enqueue with:
--   null value in column "workspace_id" of relation "dm_queue"
--   violates not-null constraint
-- which leaves the user without a reply DM.
--
-- dm_queue.account_id is NOT NULL and FKs to connected_accounts,
-- which carries workspace_id (also NOT NULL). One join is enough
-- to derive it reliably for every insert site.
--
-- Idempotent. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_dm_queue_set_workspace_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.workspace_id IS NULL AND NEW.account_id IS NOT NULL THEN
        SELECT workspace_id INTO NEW.workspace_id
        FROM connected_accounts
        WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_dm_queue_set_workspace_id ON dm_queue;
CREATE TRIGGER tr_dm_queue_set_workspace_id
    BEFORE INSERT ON dm_queue
    FOR EACH ROW
    EXECUTE FUNCTION trigger_dm_queue_set_workspace_id();

-- Defensive backfill — anything inserted between the Phase 1
-- migration and this fix that managed to land with NULL
-- workspace_id (shouldn't be possible with NOT NULL, but covers
-- any rows where the column was added before NOT NULL was enforced).
UPDATE dm_queue q SET workspace_id = ca.workspace_id
FROM connected_accounts ca
WHERE ca.id = q.account_id
  AND q.workspace_id IS NULL
  AND ca.workspace_id IS NOT NULL;
