-- ============================================================
-- Table: user_plans
-- The single source of truth for every user's billing plan.
--
-- IMPORTANT: connected_accounts has NO plan columns.
--            All plan logic reads from this table only.
--
-- Written by:
--   - /auth/callback      → on email verification (trial start)
--   - /api/payments/webhook → on successful payment
--   - /api/payments/verify  → on redirect back from Cashfree
--   - /api/auth/meta/callback → ignoreDuplicates on Instagram connect
--   - layout.js (fallback)   → if row missing on first dashboard visit
--
-- Read by:
--   - layout.js          → sidebar badge + trial banner
--   - /api/usage         → DM limit calculation
--   - all cron jobs      → billing gate before sending DMs
--   - /api/clicks        → Pro gate
--   - /api/leads         → Pro gate
--   - /api/templates     → Pro gate (POST)
--   - /api/global-automations → Pro gate (POST)
--   - /api/automations   → Pro gate (follow_up, email_collector, A/B, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_plans (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

    plan            text NOT NULL DEFAULT 'free',
    -- 'free' | 'pro' | 'business'

    -- Set when a payment succeeds. NULL = no active paid subscription.
    plan_expires_at timestamptz,

    -- Set on first account creation (email verification or Instagram connect).
    -- NULL = no trial started.
    trial_ends_at   timestamptz,

    -- Materialised monthly DM counter. Maintained by tr_dm_sent_log_count
    -- (defined below) so readers can skip the per-request COUNT(*) over
    -- dm_sent_log. dm_count_month stores 'YYYY-MM'; readers must treat a
    -- mismatch with the current month as 0.
    monthly_dm_count integer NOT NULL DEFAULT 0,
    dm_count_month   text DEFAULT NULL,

    -- Tracks which plan_expires_at value the "Pro expiring soon" reminder
    -- has already been sent for. Stores the value of plan_expires_at at
    -- the time we emailed. If it differs from the current plan_expires_at
    -- (user renewed → expiry moved forward), the cron re-sends.
    expiring_soon_emailed_for_expiry timestamptz,

    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- RLS: users can read their own plan (layout.js uses the anon/user client)
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plan"
    ON user_plans FOR SELECT
    USING (user_id = auth.uid());

-- Only service role can INSERT / UPDATE.
-- No client-side write policy — prevents users from upgrading themselves.

-- Fast single-row lookup (called on every dashboard page load)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_plans_user_id
    ON user_plans (user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_plans_updated_at
    BEFORE UPDATE ON user_plans
    FOR EACH ROW EXECUTE FUNCTION update_user_plans_updated_at();

-- ── Monthly DM counter trigger ─────────────────────────────────────────
-- Increments user_plans.monthly_dm_count atomically when dm_sent_log
-- receives a 'sent' row. Story-mention DMs (automation_id IS NULL) are
-- skipped — they're not user-billable. See add-monthly-dm-count-cache.sql.
-- Reads NEW.user_id directly. The BEFORE INSERT trigger on dm_sent_log
-- (tr_dm_sent_log_set_user_id, defined in 04_dm_sent_log.sql below this
-- run order conceptually — but actually added via migration) auto-fills
-- user_id when callers don't, so by the time this AFTER trigger runs,
-- user_id is reliably populated.
CREATE OR REPLACE FUNCTION trigger_increment_user_dm_count()
RETURNS TRIGGER AS $$
DECLARE
    v_month text := to_char(NEW.sent_at, 'YYYY-MM');
BEGIN
    IF NEW.status != 'sent' THEN
        RETURN NEW;
    END IF;
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    UPDATE user_plans
    SET monthly_dm_count = CASE
            WHEN dm_count_month = v_month THEN monthly_dm_count + 1
            ELSE 1
        END,
        dm_count_month = v_month
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_dm_sent_log_count ON dm_sent_log;
CREATE TRIGGER tr_dm_sent_log_count
    AFTER INSERT ON dm_sent_log
    FOR EACH ROW
    EXECUTE FUNCTION trigger_increment_user_dm_count();
