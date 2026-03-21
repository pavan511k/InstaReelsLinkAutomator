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
