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

-- RLS: users read their own click events via automation ownership
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own click events"
    ON click_events FOR SELECT
    USING (
        automation_id IN (
            SELECT id FROM dm_automations WHERE user_id = auth.uid()
        )
    );
