-- =============================================
-- User-level plan storage
-- Plan data lives HERE only — not on connected_accounts.
--
-- connected_accounts stores ONLY Instagram/Facebook
-- account credentials and configuration.
-- Plans are per-user, not per-account.
-- =============================================

CREATE TABLE IF NOT EXISTS user_plans (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    plan            text NOT NULL DEFAULT 'free',   -- 'free' | 'pro' | 'business'
    plan_expires_at timestamptz,                    -- NULL = no active paid subscription
    trial_ends_at   timestamptz,                    -- NULL = no trial started yet
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- RLS: users can read their own plan
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plan"
    ON user_plans FOR SELECT
    USING (user_id = auth.uid());

-- Only service role can INSERT / UPDATE (payment webhook, OAuth callback)
-- No client-side write policy intentionally

-- Fast lookups from layout (runs on every page load)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_plans_updated_at
    BEFORE UPDATE ON user_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_user_plans_updated_at();
