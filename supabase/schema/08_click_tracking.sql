-- ============================================================
-- Tables: dm_link_codes + click_events
-- Short URL click tracking for link CTR analytics.
-- dm_link_codes maps 8-char codes to original URLs.
-- click_events logs every click on a tracked link.
-- Pro/Trial feature.
-- ============================================================

-- ── dm_link_codes ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_link_codes (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code            text NOT NULL UNIQUE,           -- 8-char hex, e.g. "a1b2c3d4"
    original_url    text NOT NULL,
    automation_id   uuid REFERENCES dm_automations(id) ON DELETE CASCADE NOT NULL,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ab_variant      text DEFAULT NULL,              -- 'A' | 'B' | NULL (non-A/B automations)
    created_at      timestamptz DEFAULT now()
);

-- One code per (automation, URL) pair — prevents duplicates on re-save
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_link_codes_automation_url
    ON dm_link_codes (automation_id, original_url);

CREATE INDEX IF NOT EXISTS idx_dm_link_codes_code
    ON dm_link_codes (code);

CREATE INDEX IF NOT EXISTS idx_dm_link_codes_automation
    ON dm_link_codes (automation_id);

-- RLS
ALTER TABLE dm_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own link codes"
    ON dm_link_codes FOR SELECT
    USING (user_id = auth.uid());


-- ── click_events ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS click_events (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code            text NOT NULL,                  -- references dm_link_codes.code
    automation_id   uuid REFERENCES dm_automations(id) ON DELETE CASCADE,
    recipient_ig_id text,                           -- captured from ?r=<igsid> on the tracked URL; NULL on legacy rows
    ip_hash         text,                           -- SHA-256 of visitor IP (privacy-safe dedup)
    user_agent      text,
    referer         text,
    clicked_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_click_events_automation
    ON click_events (automation_id);

CREATE INDEX IF NOT EXISTS idx_click_events_code
    ON click_events (code);

CREATE INDEX IF NOT EXISTS idx_click_events_clicked_at
    ON click_events (clicked_at);

-- Click stats list view: WHERE automation_id = ? ORDER BY clicked_at DESC
CREATE INDEX IF NOT EXISTS idx_click_events_listing
    ON click_events (automation_id, clicked_at DESC);

-- For cron/upsell click-gating: "did this recipient click any link from
-- this automation?" — partial index keeps it tiny since legacy rows have
-- recipient_ig_id NULL.
CREATE INDEX IF NOT EXISTS idx_click_events_recipient_automation
    ON click_events (automation_id, recipient_ig_id)
    WHERE recipient_ig_id IS NOT NULL;

-- RLS: users read their own click events via automation ownership
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own click events"
    ON click_events FOR SELECT
    USING (
        automation_id IN (
            SELECT id FROM dm_automations WHERE user_id = auth.uid()
        )
    );

-- ── Auto-populate workspace_id on insert ───────────────────────
-- The /r/[code] redirect handler doesn't pass workspace_id when
-- logging clicks. Derive it from automation_id → dm_automations.
-- Without this, rows land workspace_id = NULL and any future
-- workspace-scoped query misses them.
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
